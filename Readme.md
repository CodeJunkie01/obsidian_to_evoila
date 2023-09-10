!!!!Make sure to replace root@domain.de with your actual username and domain!!!!
1. Step
node index.js

2. Step
Linux or Mac: 
- scp -rp questionaire-config root@domain.de:/home/WeKI-GO-v1.9.2/WeKI-GO-docker-compose

Windows: 
- First, download pscp from the PuTTY download page if you haven't already.
- Open Command Prompt or PowerShell.
- Navigate to the directory where pscp.exe is located, or add it to your system's PATH.
- Use the following command to copy your files:
- pscp -r questionaire-config root@domain.de:/home/WeKI-GO-v1.9.2/WeKI-GO-docker-compose

3. Step
sudo docker compose down
"sudo docker compose up -d" if config is ready for production or "sudo docker compose up" to see the logs