import fetch from 'node-fetch';
import chalk from 'chalk';
import ProxyAgent from 'proxy-agent';
import fs from 'fs/promises';
import inquirer from 'inquirer';

const headersTemplate = {
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/json',
};

function displayHeader() {
    process.stdout.write('\x1Bc');
    const logo = chalk.cyan(`
 ██████╗ ███╗   ██╗    ████████╗ ██████╗ ██████╗ 
██╔═══██╗████╗  ██║    ╚══██╔══╝██╔═══██╗██╔══██╗
██║   ██║██╔██╗ ██║       ██║   ██║   ██║██████╔╝
██║   ██║██║╚██╗██║       ██║   ██║   ██║██╔═══╝ 
╚██████╔╝██║ ╚████║       ██║   ╚██████╔╝██║     
 ╚═════╝ ╚═╝  ╚═══╝       ╚═╝    ╚═════╝ ╚═╝     
`);
    const header = chalk.cyan(`
========================================
=           Functor Checkin BOT        =
=        Remake by OnTop Airdrop       =
=       https://t.me/OnTopAirdrop      =
========================================
`);

    const terminalWidth = process.stdout.columns;
    const centeredLogo = logo.split('\n').map(line => line.padStart((terminalWidth + line.length) / 2)).join('\n');
    const centeredHeader = header.split('\n').map(line => line.padStart((terminalWidth + line.length) / 2)).join('\n');

    console.log(centeredLogo);
    console.log(centeredHeader);
    console.log();
}

async function loadSessions() {
    try {
        const data = await fs.readFile('account.txt', 'utf8');
        console.log(chalk.blue('Accounts file loaded successfully.'));
        return data.split('\n').map(line => {
            const [email, password] = line.trim().split(',');
            return { email, password };
        }).filter(account => account.email && account.password);
    } catch (error) {
        console.error(chalk.red("Error loading Accounts:"), error);
        return [];
    }
}

async function loadProxies() {
    try {
        const data = await fs.readFile('proxy.txt', 'utf8');
        console.log(chalk.blue('Proxies file loaded successfully.'));
        return data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    } catch (error) {
        console.error(chalk.red("Error loading Proxies:"), error);
        return [];
    }
}

async function coday(url, method, payloadData = null, headers = headersTemplate, proxy = null) {
    try {
        const options = {
            method,
            headers: { ...headers, 'User-Agent': await generateUserAgent() },
            body: payloadData ? JSON.stringify(payloadData) : null,
            agent: proxy ? new ProxyAgent(proxy) : undefined
        };
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        console.log(chalk.green(`Request to ${url} was successful.`));
        return await response.json();
    } catch (error) {
        console.error(chalk.red('Error in coday function:'), error.message);
        throw error;
    }
}

async function generateUserAgent() {
    const uaList = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.0"
    ];
    return uaList[Math.floor(Math.random() * uaList.length)];
}

async function loginAndCheckIn(email, password, proxy) {
    console.log(chalk.yellow(`\nAttempting login for email: ${email}`));
    const signInPayload = { email, password };
    let attempts = 3;
    while (attempts > 0) {
        try {
            const signIn = await coday("https://node.securitylabs.xyz/api/v1/auth/signin-user", 'POST', signInPayload, headersTemplate, proxy);
            if (signIn && signIn.accessToken) {
                const headers = { ...headersTemplate, 'Authorization': `Bearer ${signIn.accessToken}` };
                console.log(chalk.green('Login succeeded! Fetching user details...'));

                const user = await coday("https://node.securitylabs.xyz/api/v1/users", 'GET', null, headers, proxy);
                if (user && user.id) {
                    const { id, dipTokenBalance } = user;
                    console.log(chalk.cyan(`User id: ${id} | Current points: ${dipTokenBalance}`));

                    console.log(chalk.yellow("Attempting daily check-in..."));
                    const checkin = await coday(`https://node.securitylabs.xyz/api/v1/users/earn/${id}`, 'GET', null, headers, proxy);
                    if (checkin && checkin.tokensToAward) {
                        console.log(chalk.green(`Check-in successful! Awarded points: ${checkin.tokensToAward}`));
                    } else {
                        console.log(chalk.yellow('Check-in not available yet.'));
                    }
                } else {
                    console.error(chalk.red('Failed to fetch user details.'));
                }
                return;
            } else {
                console.error(chalk.red(`Login failed for email: ${email}`));
                return;
            }
        } catch (error) {
            if (error.message.includes('403')) {
                console.log(chalk.yellow(`Forbidden (403). Retrying login for email: ${email}... (${attempts - 1} attempts left)`));
                attempts--;
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else if (error.message.includes('503')) {
                console.log(chalk.yellow(`Service unavailable (503). Retrying login for email: ${email}... (${attempts - 1} attempts left)`));
                attempts--;
                await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
                console.error(chalk.red(`Unexpected error for email: ${email}`), error.message);
                return;
            }
        }
    }
    console.error(chalk.red(`Max retry attempts reached. Login failed for email: ${email}`));
}

async function main() {
    displayHeader();

    const { runMode } = await inquirer.prompt([
        {
            type: 'list',
            name: 'runMode',
            message: 'Choose the run mode:',
            choices: ['Run Once', 'Run Every 24 Hours']
        }
    ]);

    console.log(chalk.blue("Loading sessions..."));
    const sessions = await loadSessions();
    console.log(chalk.green("Sessions loaded successfully."));

    console.log(chalk.blue("Loading proxies..."));
    const proxies = await loadProxies();
    console.log(chalk.green("Proxies loaded successfully."));

    if (sessions.length === 0) {
        console.log(chalk.red("No Accounts found."));
        return;
    }

    if (proxies.length < sessions.length) {
        console.error(chalk.red("Error: Not enough proxies for the number of accounts."));
        return;
    }

    do {
        console.log(chalk.yellow("\nStarting daily check-in process for all accounts..."));

        for (let i = 0; i < sessions.length; i++) {
            const { email, password } = sessions[i];
            const proxy = proxies[i];

            if (email && password) {
                console.log(chalk.magenta(`Using proxy ${proxy} for account ${email}`));
                await loginAndCheckIn(email, password, proxy);
            }
        }

        if (runMode === 'Run Once') {
            console.log(chalk.green("All accounts processed. Exiting..."));
            return;
        }

        console.log(chalk.yellow("All accounts processed. Waiting 24 hours for the next check-in..."));
        await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));
    } while (runMode === 'Run Every 24 Hours');
}

main().catch(error => console.error(chalk.red("Error in main:"), error));
