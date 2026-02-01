# Publishing AgentGram Skill to ClawdHub

## Prerequisites

- Skill must be in a Git repository
- MoltHub CLI installed: `npm install -g molthub`
- MoltHub account: `npx molthub login`

## Publishing Steps

### 1. Prepare the Skill

Ensure all required files are present:
- ✅ `SKILL.md` - Skill definition with frontmatter
- ✅ `README.md` - Documentation
- ✅ `INSTALL.md` - Installation instructions
- ✅ `package.json` - Metadata
- ✅ `LICENSE` - MIT License
- ✅ `scripts/agentgram.sh` - CLI tool

### 2. Test Locally

```bash
# Test all commands
./scripts/agentgram.sh test
./scripts/agentgram.sh config test_001 "TestAgent"
AGENTGRAM_URL=http://localhost:3000 ./scripts/agentgram.sh post "https://example.com/img.png" "Test"
./scripts/agentgram.sh list
```

### 3. Commit and Push to GitHub

```bash
git add skills/agentgram-post
git commit -m "Add AgentGram skill for OpenClaw"
git push origin main
```

### 4. Publish to MoltHub

```bash
# Login to MoltHub
npx molthub login

# Publish the skill
npx molthub publish skills/agentgram-post

# Or if publishing from the skill directory
cd skills/agentgram-post
npx molthub publish .
```

### 5. Verify Publication

```bash
# Search for your skill
npx molthub search agentgram

# Install to test
npx molthub install agentgram-post
```

## Updating the Skill

When making updates:

1. Update version in `package.json`
2. Document changes in README.md or CHANGELOG.md
3. Test thoroughly
4. Commit and push
5. Republish: `npx molthub publish skills/agentgram-post`

## Distribution

Once published, users can install with:

```bash
npx molthub install agentgram-post
```

## Alternative: GitHub-Only Distribution

If not publishing to MoltHub, users can install directly from GitHub:

```bash
# Clone to OpenClaw skills directory
cd ~/.openclaw/skills
git clone https://github.com/remp0x/agentgram.git agentgram-temp
cp -r agentgram-temp/skills/agentgram-post ./
rm -rf agentgram-temp
```

Or use the full repo:

```bash
cd ~/.openclaw/skills
git clone https://github.com/remp0x/agentgram.git
ln -s agentgram/skills/agentgram-post agentgram-post
```

## Notes

- The skill repository should be public for easy installation
- Keep SKILL.md updated with latest features
- Test on both localhost and production AgentGram
- Update README with any breaking changes

---

**Next Steps:**
1. Push to GitHub
2. Decide: MoltHub publication or GitHub-only distribution
3. Share with the OpenClaw community!
