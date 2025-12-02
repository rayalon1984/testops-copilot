#!/bin/bash
# Pimp My Git Profile - Enhanced Git Configuration
# Review and run this script to improve your git experience

echo "🎨 Pimping your Git profile..."

# Better Colors
git config --global color.ui auto
git config --global color.branch.current "yellow bold"
git config --global color.branch.local "green"
git config --global color.branch.remote "cyan"
git config --global color.status.added "green bold"
git config --global color.status.changed "yellow bold"
git config --global color.status.untracked "red bold"

# Useful Aliases
git config --global alias.st "status -sb"
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.unstage "reset HEAD --"
git config --global alias.last "log -1 HEAD"
git config --global alias.lg "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --date=relative"
git config --global alias.lga "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit --date=relative --all"
git config --global alias.graph "log --graph --oneline --decorate --all"
git config --global alias.contributors "shortlog -sn"
git config --global alias.amend "commit --amend --no-edit"
git config --global alias.undo "reset --soft HEAD~1"
git config --global alias.discard "checkout --"
git config --global alias.branches "branch -a"
git config --global alias.tags "tag -l"
git config --global alias.stashes "stash list"
git config --global alias.remotes "remote -v"
git config --global alias.clean-branches "!git branch --merged | grep -v '\\*\\|main\\|master\\|develop' | xargs -n 1 git branch -d"

# Better Defaults
git config --global push.default current
git config --global pull.rebase true
git config --global rebase.autoStash true
git config --global fetch.prune true
git config --global diff.colorMoved zebra
git config --global core.autocrlf input
git config --global init.defaultBranch main

# Help & Performance
git config --global help.autocorrect 10
git config --global core.preloadindex true
git config --global core.fscache true
git config --global gc.auto 256

# Commit Template (optional - creates a template file)
cat > ~/.gitmessage << 'EOF'
# <type>: <subject> (max 50 chars)
# |<----  Using a Maximum Of 50 Characters  ---->|

# Explain why this change is being made
# |<----   Try To Limit Each Line to a Maximum Of 72 Characters   ---->|

# Provide links or keys to any relevant tickets, articles or other resources
# Example: Github issue #23

# --- COMMIT END ---
# Type can be
#    feat     (new feature)
#    fix      (bug fix)
#    refactor (refactoring code)
#    style    (formatting, missing semi colons, etc; no code change)
#    docs     (changes to documentation)
#    test     (adding or refactoring tests; no production code change)
#    chore    (updating build tasks, package manager configs, etc; no production code change)
# --------------------
# Remember to
#    Capitalize the subject line
#    Use the imperative mood in the subject line
#    Do not end the subject line with a period
#    Separate subject from body with a blank line
#    Use the body to explain what and why vs. how
#    Can use multiple lines with "-" for bullet points in body
# --------------------
EOF

git config --global commit.template ~/.gitmessage

echo ""
echo "✨ Git profile enhanced!"
echo ""
echo "New aliases available:"
echo "  git st           - Short status"
echo "  git lg           - Beautiful log graph"
echo "  git lga          - Beautiful log graph (all branches)"
echo "  git graph        - Simple graph view"
echo "  git amend        - Amend last commit"
echo "  git undo         - Undo last commit (keep changes)"
echo "  git contributors - See all contributors"
echo "  git clean-branches - Remove merged branches"
echo ""
echo "Try: git lg"
