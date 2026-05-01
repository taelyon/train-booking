import urllib.request
import json
req = urllib.request.Request('https://api.github.com/repos/carpedm20/korail2/pulls/54', headers={'User-Agent': 'Mozilla/5.0'})
try:
    res = urllib.request.urlopen(req)
    issue = json.loads(res.read())
    print("BODY:")
    print(issue['body'])
except Exception as e:
    pass

req = urllib.request.Request('https://api.github.com/repos/carpedm20/korail2/pulls/54/files', headers={'User-Agent': 'Mozilla/5.0'})
try:
    res = urllib.request.urlopen(req)
    files = json.loads(res.read())
    for f in files:
        print(f"FILE: {f['filename']}")
        print(f['patch'])
except Exception as e:
    pass
