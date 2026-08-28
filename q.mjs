import pg from 'pg'
const c=new pg.Client({connectionString:process.env.DB_URL,ssl:{rejectUnauthorized:false}});await c.connect()
const r=await c.query(`select e.id, m.first_name||' '||m.last_name persona, g.name grupo, e.grade, e.updated_at
 from study_enrollments e join members m on m.id=e.member_id left join study_groups g on g.id=e.group_id
 where e.status='en_revision' and e.grade is not null`)
console.table(r.rows); console.log('IDS:', r.rows.map(x=>x.id).join(','))
await c.end()
