const github = require("@actions/github");
const core = require("@actions/core");
const { default: axios } = require("axios");

async function run() {
    try  {
    const {GITHUB_REPOSITORY, GITHUB_REF} = process.env;
    const prNum = GITHUB_REF.match(/^refs\/pull\/(.+)\/merge$/)[1];
    const [owner, repo] = GITHUB_REPOSITORY.split("/");
    const token = core.getInput("token");
    const model = core.getInput("model");
    const apiKey = core.getInput("api-key");
    const systemPrompt = core.getInput("system-prompt");
    const octokit = github.getOctokit(token)
    
    const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNum,
    });

    let fileChanges = "";
    for(const file of files) {
        const {filename, patch} = file;
        fileChanges += `### ${filename}\n\`\`\`diff\n${patch}\n\`\`\`\n\n`;
    }

    if(!fileChanges) {
        console.log("변경된 파일이 없습니다.")
        return;
    }

    const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `다음 변경된 코드에 대한 피드백을 작성해줘:\n\n${fileChanges}` }
            ],
            max_tokens: 800,
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
        }
    )
    const aiResponse = response.data.choices[0].message.content;

    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNum,
        body: `# 🤖AI Review\n${aiResponse}`
    });
} catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
}
}

run();
