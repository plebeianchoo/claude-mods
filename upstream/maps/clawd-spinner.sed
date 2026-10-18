# clawd-spinner paths -> cat-clawd-duo/hooks/clawd/ (register.tsx became
# clawd.tsx; hooks.json and the manifest are the duo's own), tests prefixed clawd-.
/^\(diff --git\|---\|+++\) /{
s# \([ab]\)/hooks/hooks\.json# \1/DROPPED/hooks.json#g
s# \([ab]\)/hooks/register\.tsx# \1/cat-clawd-duo/hooks/clawd/clawd.tsx#g
s# \([ab]\)/hooks/# \1/cat-clawd-duo/hooks/clawd/#g
s# \([ab]\)/tests/# \1/cat-clawd-duo/tests/clawd-#g
}
/^\(diff --git\|---\|+++\) /!{
s#'\.\./hooks/\([a-z]*\)'#'../hooks/clawd/\1'#g
}
