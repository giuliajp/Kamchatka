import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',
  fullyParallel:true,
  workers:2,
  timeout:30000,
  expect:{timeout:7000},
  forbidOnly:Boolean(process.env.CI),
  retries:process.env.CI?1:0,
  reporter:[['list'],['html',{open:'never'}]],
  use:{browserName:'chromium',channel:process.env.PLAYWRIGHT_CHANNEL,trace:'retain-on-failure',screenshot:'only-on-failure'},
  webServer:[
    {command:'npm run build && npm run preview -- --port 5185 --strictPort',url:'http://127.0.0.1:5185',timeout:120000},
    {command:'npm --prefix ../admin-panel run build && npm --prefix ../admin-panel run preview -- --port 5186 --strictPort',url:'http://127.0.0.1:5186',timeout:120000},
  ],
});
