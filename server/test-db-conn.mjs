import 'dotenv/config';
import sql from './configs/db.js';

async function main(){
  try{
    const res = await sql`select now() as now`;
    console.log('DB query result:');
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('DB connection/query error:');
    console.error(err);
    process.exit(1);
  }
}

main();
