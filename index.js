const commander = require('commander');
const express = require('express');
const exec = require('child_process').exec;

const program = new commander.Command();

program
	.command('start [port]')
	.action((port='random') => {
		if (port === 'random') port = Math.floor(Math.random() * (65535 - 1024)) + 1024;
		const app = express();
        app.use(express.static(__dirname));
        app.listen(port, () => {
            console.log(`Script server started at http://localhost:${port}`);
            try {
                const commands = {darwin: 'open -a "Firefox"', win32: 'start Firefox', linux: 'nohup firefox'};
                exec(`${commands[process.platform]} "http://localhost:${port}/index.user.js"`);
            }
            catch (e) {
                console.error('Failed to open Firefox automatically. Open this URL to continue:');
                console.error(`http://localhost:${port}/index.user.js`);
				console.log('\n', 'More information:', e);
            }
        });
	});

program.parse(process.argv);