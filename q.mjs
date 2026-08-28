import pg from 'pg'
const c=new pg.Client({connectionString:process.env.DB_URL,ssl:{rejectUnauthorized:false}});await c.connect()
const r=await c.query(`select title, flyer_url from events where flyer_url is not null order by created_at desc limit 14`)
console.log('eventos con flyer:', (await c.query(`select count(*) n from events where flyer_url is not null`)).rows[0].n)
for (const x of r.rows) console.log(x.flyer_url)
await c.end()
