# hoobnn-agent-mods paths -> spinner/. The kit's sources are copied into
# spinner/hooks/kit/ with a one-line header, so their patches apply at an offset.
/^\(diff --git\|---\|+++\) /{
s# \([ab]\)/claude-code/kit/\(README\.md\|tsconfig\.json\)# \1/DROPPED/\2#g
s# \([ab]\)/claude-code/spinner/# \1/spinner/#g
s# \([ab]\)/claude-code/kit/# \1/spinner/hooks/kit/#g
}
