import { createApp } from './app.ts'
import { env } from './env.ts'
import { migrate } from './migrate.ts'

await migrate()
const app = createApp()
app.listen(env.apiPort, env.apiHost, () => {
  console.log(`study-planner API listening on http://${env.apiHost}:${env.apiPort}`)
})
