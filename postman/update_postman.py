import json
import os
import re

collection_path = r'd:\Harshit-Projects\Morval-Investments\Investor-tracking-system\postman\Morval Investor API.postman_collection.json'
new_collection_path = r'd:\Harshit-Projects\Morval-Investments\Investor-tracking-system\postman\Morval Investor API (Updated).postman_collection.json'

with open(collection_path, 'r', encoding='utf-8') as f:
    col = json.load(f)

# The base url variable logic: the user says use LOCAL_URL, DEV_URL, PROD_URL.  
# But typically a request just uses {{API_URL}} or similar, and the environment provides it. 
# "use LOCAL_URL, DEV_URL, PROD_URL as variables, use enviroment for each project"
# I will set the base URL to {{API_URL}} uniformly, and maybe define variables if needed.
# Or maybe I replace {{prod}} with {{API_URL}}.

def process_item(item):
    if 'item' in item:
        # Folder
        for child in item['item']:
            process_item(child)
        return
        
    req = item.get('request', {})
    if not req: return

    # 1. Update URLs (replace {{prod}} with {{API_URL}})
    if 'url' in req:
        if isinstance(req['url'], dict):
            raw = req['url'].get('raw', '')
            raw = raw.replace('{{prod}}', '{{API_URL}}')
            req['url']['raw'] = raw
            if 'host' in req['url']:
                req['url']['host'] = ['{{API_URL}}']
                
            # 3. GET params
            if req.get('method') == 'GET':
                # ensure query array exists if there are params in raw URL
                if '?' in raw:
                    q_str = raw.split('?')[1]
                    pairs = q_str.split('&')
                    if 'query' not in req['url']:
                        req['url']['query'] = []
                    existing_keys = [q['key'] for q in req['url'].get('query', [])]
                    for pair in pairs:
                        if '=' in pair:
                            k, v = pair.split('=', 1)
                            if k not in existing_keys:
                                req['url']['query'].append({'key': k, 'value': v, 'description': '(Optional)'})
        elif isinstance(req['url'], str):
            req['url'] = req['url'].replace('{{prod}}', '{{API_URL}}')

    # 0. Auth inheritance
    # remove explicit apikey and token headers
    if 'header' in req:
        new_headers = []
        for h in req['header']:
            if h.get('key') not in ['apikey', 'token']:
                new_headers.append(h)
        req['header'] = new_headers
    
    # ensure it inherits auth unless signup/login
    is_auth_route = ('signup' in item['name'].lower() or 'login' in item['name'].lower())
    
    if is_auth_route:
        # Set event script for token extraction using pm.environment
        script = [
            "if (pm.response.code === 200) {",
            "    const response = pm.response.json();",
            "    if (response.s === 1 && response.r && response.r.auth) {",
            "        pm.environment.set('apikey', response.r.auth.apikey);",
            "        pm.environment.set('token', response.r.auth.token);",
            "    }",
            "}"
        ]
        # Find test event or create one
        events = item.get('event', [])
        found_test = False
        for ev in events:
            if ev.get('listen') == 'test':
                found_test = True
                ev['script']['exec'] = script
                break
        if not found_test:
            events.append({
                "listen": "test",
                "script": {
                    "exec": script,
                    "type": "text/javascript"
                }
            })
        item['event'] = events
        # explicit no auth
        req['auth'] = {"type": "noauth"}
    else:
        # inherit auth from parent
        # Just removing "auth" entirely or setting type to "inherit"
        # Since postman implies inherit if auth is not set at request level or set to inherit
        if 'auth' in req:
            del req['auth'] # In postman schema, absent auth means inherit or collection level

    # 1. form-data by default
    if req.get('method') in ['POST', 'PUT', 'PATCH']:
        if 'body' not in req:
            req['body'] = {'mode': 'formdata', 'formdata': []}
        elif req['body'].get('mode') != 'formdata':
            req['body']['mode'] = 'formdata'
            if 'formdata' not in req['body']:
                req['body']['formdata'] = []

    # 4 & 5. Descriptions and Enums
    def process_fields(fields_list):
        for field in fields_list:
            desc = field.get('description', '')
            is_req = 'required' in desc.lower() or 'optional' not in desc.lower() # default to required if not stated
            if 'optional' in desc.lower(): is_req = False
            
            key = field.get('key', '')
            
            # clean up description base
            # Remove existing generic fluff
            # "First name (required)" -> "(Required)"
            # Let's keep the rules strict:
            prefix = "(Required)" if is_req else "(Optional)"
            
            # Enums logic based on schemas
            enum_str = ""
            k_low = key.lower()
            if k_low == 'status':
                enum_str = " 1: active | 0: pending | -1: delete | 2: disabled | 2: rejected/overdue"
            elif k_low == 'role':
                enum_str = " 1: Investor | 2: Admin"
            elif k_low == 'contract_type':
                enum_str = " 0: monthly_payable | 1: monthly_compounding"
            elif k_low == 'payment_type':
                enum_str = " 0: monthly_interest | 1: compound_maturity"
            elif k_low == 'temp_signup':
                enum_str = " 1: temp | 0: normal"

            # If it's a generic field without enums, just output (Required)/(Optional)
            if enum_str:
                field['description'] = f"{prefix} {enum_str.strip()}"
            else:
                field['description'] = f"{prefix}"

    if 'body' in req and req['body'].get('mode') == 'formdata':
        process_fields(req['body'].get('formdata', []))
    
    if 'url' in req and isinstance(req['url'], dict) and 'query' in req['url']:
        process_fields(req['url'].get('query', []))

# We need to process all roots
for item in col.get('item', []):
    process_item(item)

# Add collection level auth as instructions imply:
col['auth'] = {
    "type": "apikey",
    "apikey": [
        {"key": "value", "value": "{{apikey}}", "type": "string"},
        {"key": "key", "value": "apikey", "type": "string"},
        {"key": "in", "value": "header", "type": "string"}
    ]
}
# But there's two tokens, Apikey and token. Postman's auth type doesn't support 2 API keys elegantly.
# So we add a pre-request script at the collection level
col_events = col.get('event', [])
prereq_script = [
    "pm.request.headers.add({key: 'apikey', value: pm.environment.get('apikey')});",
    "pm.request.headers.add({key: 'token', value: pm.environment.get('token')});"
]
found_prereq = False
for ev in col_events:
    if ev.get('listen') == 'prerequest':
        ev['script']['exec'] = prereq_script
        found_prereq = True
        break
if not found_prereq:
    col_events.append({
        "listen": "prerequest",
        "script": {
            "type": "text/javascript",
            "exec": prereq_script
        }
    })
col['event'] = col_events
col['auth'] = {"type": "noauth"} # We handle it via pre-request

# Variables for DEV_URL, PROD_URL etc
col_vars = col.get('variable', [])
urls = ['LOCAL_URL', 'DEV_URL', 'PROD_URL']
existing_vars = [v['key'] for v in col_vars]
for u in urls:
    if u not in existing_vars:
        col_vars.append({"key": u, "value": "http://localhost:3000/api", "type": "string"})
if 'API_URL' not in existing_vars:
    col_vars.append({"key": "API_URL", "value": "{{LOCAL_URL}}", "type": "string"})
col['variable'] = col_vars

with open(new_collection_path, 'w', encoding='utf-8') as f:
    json.dump(col, f, indent=4)

print("Collection updated successfully.")
