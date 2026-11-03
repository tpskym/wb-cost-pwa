import {readFileSync} from 'node:fs';
const text=readFileSync(process.argv[2],'utf8');
for(const block of text.split(/(?=not ok \d+ - )/).slice(1)){const message=block.split('\n  ...')[0].slice(0,5000);process.stdout.write('::error::'+message.replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A')+'\n');}
