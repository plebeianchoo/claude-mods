# cat-spinner paths -> cat-clawd-duo/ (register.tsx became cat.tsx; hooks.json
# is the duo's own), and the renames the duo applied to its keys and imports.
/^\(diff --git\|---\|+++\) /{
s# \([ab]\)/hooks/hooks\.json# \1/DROPPED/hooks.json#g
s# \([ab]\)/hooks/register\.tsx# \1/cat-clawd-duo/hooks/cat.tsx#g
s# \([ab]\)/hooks/# \1/cat-clawd-duo/hooks/#g
s# \([ab]\)/tests/# \1/cat-clawd-duo/tests/#g
s# \([ab]\)/\.claude-plugin/plugin\.json# \1/cat-clawd-duo/.claude-plugin/plugin.json#g
}
/^\(diff --git\|---\|+++\) /!{
s#'\.\./hooks/register'#'../hooks/cat'#g
s/plugin: 'cat-spinner'/plugin: 'cat-clawd-duo'/g
s/\(['"`]\)cat-spinner\./\1cat-clawd-duo./g
}
