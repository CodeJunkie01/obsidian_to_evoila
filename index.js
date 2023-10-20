const fs = require("fs");
const path = require("path");

const obsidianFolderPath = "./obsidianFolder";
const outputFolderPath = "./questionaire-config"; //recommended
const recommendations = [];
const questions = [];
const questions_part1 = [];
const rules = [];
const conditionGroups = [];
const basicConditions = [];
let rulesObject = {};
const warnings = [];
let questionNumber = 1;
const processFiles = async () => {
  //first create questions and answers from the markdown files
  fs.readdir(obsidianFolderPath, (err, files) => {
    if (err) {
      console.error("Could not list the directory.", err);
      return;
    }

    files.forEach((file) => {
      if (path.extname(file) === ".md") {
        const filePath = path.join(obsidianFolderPath, file);
        fs.readFile(filePath, "utf8", (err, content) => {
          if (err) {
            console.error(`Could not read the file ${file}.`, err);
            return;
          }
          const fileType = determineFileType(content);
          if (fileType === "CASE") {
            const questionsFromContent = createQuestions(content, file);
            questionsFromContent?.forEach((question) => {
              if (question.part === 1) {
                questions_part1.push({
                  id: question.id,
                  questionText: question.questionText,
                  answers: question.answers,
                  position: question.position,
                });
              } else {
                questions.push({
                  id: question.id,
                  questionText: question.questionText,
                  answers: question.answers,
                  position: question.position,
                });
              }
            });
          }
          if (fileType === "REC") {
            const recommendation = createRecommendations(content, file);
            recommendations.push(recommendation);
          }
          if (fileType === "COND") {
            handleConditions(content, file);
          }
        });
      }
    });
  });

  await sleep(2000);
  const cleanedConditionGroups = conditionGroups
    .map((cg) => {
      const list = cg.list.filter((condition) => {
        if (
          !conditionGroups.map((cg) => cg.id).includes(condition) &&
          !basicConditions.map((bc) => bc.id).includes(condition)
        ) {
          warnings.push(
            "Bedingung " +
              condition +
              " existiert nicht, wurde aber in einer CG verwendet"
          );
          return false;
        }
        return true;
      });
      if (list.length === 0) {
        warnings.push("ConditionGroup " + cg.id + " hat keine Bedingungen");
        return null;
      }
      return {
        id: cg.id,
        type: cg.type,
        list: cg.list.filter((condition) => {
          if (
            !conditionGroups.map((cg) => cg.id).includes(condition) &&
            !basicConditions.map((bc) => bc.id).includes(condition)
          ) {
            warnings.push(
              "Bedingung " +
                condition +
                " existiert nicht, wurde aber in einer CG verwendet"
            );
            return false;
          }
          return true;
        }),
      };
    })
    .filter((cg) => cg !== null);
  const deduplicatedAndCleanedRules = rules.reduce((acc, current) => {
    const x = acc.find((item) => item.condition === current.condition);
    // if exists add weightedRecommendations to existing rule
    if (
      !cleanedConditionGroups.map((cg) => cg.id).includes(current.condition) &&
      !basicConditions.map((bc) => bc.id).includes(current.condition)
    ) {
      warnings.push("Bedingung " + current.condition + " existiert nicht");
      return acc;
    }

    if (x) {
      const cleanedRecommendations = current.weightedRecommendations.filter(
        (rec) => {
          if (
            !recommendations.map((rec) => rec.id).includes(rec.recommendation)
          ) {
            warnings.push(
              "Empfehlung " +
                rec.recommendation +
                " existiert nicht, wurde aber in einer Regel verwendet"
            );
            return false;
          }
          return true;
        }
      );

      x.weightedRecommendations = [
        ...x.weightedRecommendations,
        ...cleanedRecommendations,
      ];
      return acc;
    }
    // if not exists add new rule
    const cleanedRecommendations = current.weightedRecommendations.filter(
      (rec) => {
        if (
          !recommendations.map((rec) => rec.id).includes(rec.recommendation)
        ) {
          warnings.push(
            "Empfehlung " +
              rec.recommendation +
              " existiert nicht, wurde aber in einer Regel verwendet"
          );
          return false;
        }
        return true;
      }
    );
    current.weightedRecommendations = cleanedRecommendations;
    return [...acc, current];
  }, []);

  rulesObject = {
    rules: deduplicatedAndCleanedRules,
    conditionGroups: cleanedConditionGroups,
    basicConditions,
  };

  console.log(warnings);
  //create output folder if not exists
  if (!fs.existsSync(outputFolderPath)) {
    fs.mkdirSync(outputFolderPath);
  }
  fs.writeFile(
    outputFolderPath + "/questions_part1.json",
    JSON.stringify({ questions: questions_part1.sort((a, b) => parseInt(a.position, 10) - parseInt(b.position, 10)).map(q => {return {id: q.id, questionText: q.questionText, answers: q.answers}}) }),
    function (err) {
      if (err) throw err;
      console.log("Questions part 1 written");
    }
  );
  // write the output files
  fs.writeFile(
    outputFolderPath + "/questions_part2.json",
    JSON.stringify({ questions: questions.sort((a, b) => {
      console.log({a,b});
      return parseInt(a.position, 10) - parseInt(b.position, 10);
    }).map(q => {return {id: q.id, questionText: q.questionText, answers: q.answers}})
    }),
    function (err) {
      if (err) throw err;
      console.log("Questions part 2 written");
    }
  );
  fs.writeFile(
    outputFolderPath + "/recommendations.json",
    JSON.stringify({ recommendations: recommendations }),
    function (err) {
      if (err) throw err;
      console.log("Recommendations written");
    }
  );
  fs.writeFile(
    outputFolderPath + "/rules.json",
    JSON.stringify(rulesObject),
    function (err) {
      if (err) throw err;
      console.log("Rules written");
    }
  );
};
processFiles();
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const handleConditions = (content, fileName) => {
  const ruleStrings = content
    .split("\n")
    .filter((line) => line.includes("-->"));
  ruleStrings.forEach((rule) => {
    let condition;
    const isCG = determineIfRuleIsConditionGroup(rule);
    if (isCG) {
      const condtionSite = rule.split("-->")[0].trim();
      //({ condtionSite });
      condition = findAndReplace(condtionSite);
    } else {
      condition = getSingleCondition(rule, fileName);
    }
    const recommendations = getRecommendations(rule);
    if (!recommendations) {
      warnings.push("Regel ohne Empfehlung: " + rule);
      return;
    }
    rules.push({
      condition,
      weightedRecommendations: recommendations,
    });
    //console.log({ condition, recommendations, rule, isCG });
  });
};
const getRecommendations = (rule) => {
  const recommendationSite = rule.split("-->")[1].trim();
  const recommendationIds = recommendationSite.match(/\[\[.*?\]\]/g);
  if (!recommendationIds) return null;
  return recommendationIds.map((id) => {
    return { weight: 1, recommendation: id };
  });
};
const getSingleCondition = (rule, fileName) => {
  const conditionSite = rule.split("-->")[0].trim();
  const matches = conditionSite.match(/\[\[.*?\]\]/g);
  if (matches && matches.length !== 1) {
    warnings.push(
      "Regel mit mehr als einer Bedingung in Datei wurde nicht als CG erkannt " +
        fileName
    );
  } else if (matches && matches.length === 1) return matches[0];

  warnings.push("Regel ohne Bedingung: " + rule);
};
const determineIfRuleIsConditionGroup = (rule) => {
  const conditionSite = rule.split("-->")[0].trim();
  const matches = conditionSite.match(/\[\[.*?\]\]/g);
  const count = matches ? matches.length : 0;
  if (count > 1) {
    return true;
  }
  return false;
};
function createCG(containingConditions, type) {
  const id = "[[" + Math.random().toString(36).substring(2) + "]]";
  //console.log({ id, containingConditions, type });
  const conditionGroup = {
    id,
    type: type === "UND" ? "AND" : "OR",
    list: containingConditions,
  };
  conditionGroups.push(conditionGroup);
  return id;
}
function findAndReplace(str) {
  let reg = /\(([^()]+)\)/g;
  let match = reg.exec(str);

  if (match) {
    let conditions = match[1].match(/\[\[([^\]]+)\]\]/g);
    let typeIsAnd = match[1].includes("UND") || match[1].includes("und");
    let type = typeIsAnd ? "AND" : "OR";
    str = str.replace(match[0], createCG(conditions, type));
    return findAndReplace(str);
  } else {
    let conditions = str.match(/\[\[([^\]]+)\]\]/g);
    if (conditions) {
      let type = str.includes("UND") || str.includes("und") ? "UND" : "OR";
      return createCG(conditions, type);
    }
  }

  return str;
}

const createRecommendations = (content, fileName) => {
  const recommendationName = fileName.split(".")[0];
  const recommendationText = content.split("Text:")[1]?.trim();
  if (!recommendationText || recommendationText === "")
    warnings.push("Empfehlung ohne Text in Datei " + fileName);
  const fileString = content?.split("FFF")[1]?.trim();
  let files;
  if (fileString && fileString !== "") {
    console.log(fileString);
    files = JSON.parse("[" + fileString + "]" || "[]");
  }
  return {
    id: "[[" + recommendationName + "]]",
    text: recommendationText,
    title: recommendationName.replaceAll("_", " "),
    files: files || [],
  };
};

const createQuestions = (content, fileName) => {
  const questionNameBase = "Frage-";
  if (!content.includes("Frage:")) return null;
  const lines = content.split("\n");
  //questions are separated by a line containing "Frage:"
  const questionsLines = [];
  let tempArray = [];
  let recording = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Frage:")) {
      if (recording) {
        questionsLines.push(tempArray);
        tempArray = [];
      }
      recording = true;
      tempArray.push(lines[i]);
    } else if (recording) {
      tempArray.push(lines[i]);
    }
  }
  if (tempArray.length > 0) {
    questionsLines.push(tempArray);
  }
  const position = content?.split("Reihenfolge:")?.[1]?.split("\n")[0]?.trim()

  let answerIndex = 1;
  const questions = questionsLines.map((questionLines, index) => {
    const questionName = questionNameBase + questionNumber++;
    let questionText = questionLines[0].split(":")[1].trim();
    let part = 2;
    if (questionText === "")
      warnings.push("Frage ohne Text in Datei " + fileName);
    if (questionText.includes("#1")) {
      part = 1;
      questionText = questionText.replace("#1", "").trim();
    }
    const answers = getAnswers(
      questionLines,
      questionName,
      content,
      answerIndex
    );
    answerIndex += answers.length;
    return {
      id: questionName,
      questionText,
      answers: answers,
      part,
      position: position || "0",
    };
  });

  return questions;
};
const createBasicConditions = (
  filecontent,
  answerIndex,
  answerID,
  questionID,
  match = true
) => {
  const id = filecontent
    .split("\n")
    .find((line) => line.includes(`C${answerIndex}:`))
    ?.split(":")[1]
    ?.trim();
  if (!id) {
    //warnings.push(answerID + " hat keine Bedingung");
    return;
  }
  basicConditions.push({
    id,
    answer: answerID,
    question: questionID,
    match: match.toString(),
  });
};
const getAnswers = (questionLines, questionName, filecontent, answerIndex) => {
  const lines = questionLines.filter((line) => line.match(/A[0-9]+:/));
  const answers = lines.map((line) => {
    const answerID = questionName + "_A" + answerIndex;
    createBasicConditions(filecontent, answerIndex, answerID, questionName);
    answerIndex++;
    const answerText = line.split(":")[1].trim();

    return {
      id: answerID,
      answerText,
    };
  });
  return answers;
};

const determineFileType = (content) => {
  if (content.includes("#Empfehlung")) {
    return "REC";
  }
  if (content.includes("#Condition")) {
    return "COND";
  }
  if (content.includes("#Case")) {
    return "CASE";
  }
};
