import { spawn } from 'child_process';

const proc = spawn('/opt/homebrew/opt/node@22/bin/node', ['dist/index.js'], {
  cwd: '/Users/ln/mcp-server-tmdb',
  env: {
    ...process.env,
    TMDB_API_KEY: '72e579cb54246d5c0dda13bc885cc2e6'
  }
});

proc.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

proc.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

proc.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});