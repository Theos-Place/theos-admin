/** Quién puede MOVER y quién puede SACAR del grupo, medido contra el código real. */
import { STUDY_ADMIN_ROLES, GROUP_ADMIN_ROLES, ROLES } from '../../src/lib/auth/roles'

const todos = Object.keys(ROLES ?? {})
console.log('MOVER de grupo (STUDY_ADMIN_ROLES, y el API exige lo mismo):')
for (const r of STUDY_ADMIN_ROLES) console.log('   ·', r)
console.log('\nGROUP_ADMIN_ROLES (lo que se usa para otras cosas del grupo):')
for (const r of GROUP_ADMIN_ROLES) console.log('   ·', r)
console.log('\nroles del sistema:', todos.length ? todos.join(', ') : '(no expuestos como objeto)')
