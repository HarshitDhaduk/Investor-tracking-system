import json
import uuid
import datetime

envs = ['LOCAL', 'DEV', 'PROD']

base_vars = [
    {"key": "LOCAL_URL", "value": "http://localhost:3000/api", "enabled": True},
    {"key": "DEV_URL", "value": "https://dev-api.morval.com/api", "enabled": True},
    {"key": "PROD_URL", "value": "https://api.morval.com/api", "enabled": True},
    {"key": "apikey", "value": "", "enabled": True},
    {"key": "token", "value": "", "enabled": True}
]

# The user might want the requests to specifically use {{LOCAL_URL}} or they want each env to define it.
# Usually, a single {{API_URL}} is better. If we use {{API_URL}}, we should define it in each environment.
# Since user explicitly said "use LOCAL_URL, DEV_URL, PROD_URL as variables", I'll include them.
# I'll also add API_URL which dynamically maps to one of them based on the environment.

for env in envs:
    env_vars = base_vars.copy()
    if env == 'LOCAL':
        env_vars.append({"key": "API_URL", "value": "{{LOCAL_URL}}", "enabled": True})
    elif env == 'DEV':
        env_vars.append({"key": "API_URL", "value": "{{DEV_URL}}", "enabled": True})
    else:
        env_vars.append({"key": "API_URL", "value": "{{PROD_URL}}", "enabled": True})

    env_data = {
        "id": str(uuid.uuid4()),
        "name": f"Morval Investor API - {env}",
        "values": env_vars,
        "_postman_variable_scope": "environment",
        "_postman_exported_at": datetime.datetime.utcnow().isoformat() + "Z",
        "_postman_exported_using": "Postman/10.14.0"
    }
    
    filename = f"d:/Harshit-Projects/Morval-Investments/Investor-tracking-system/postman/Investor Tracking APIs - {env}.postman_environment.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(env_data, f, indent=4)

print("Environments generated successfully.")
