# hoobnn-agent-mods paths -> spinner/. Only claude-code/spinner is tracked:
# upstream syncs its shared kit into claude-code/spinner/hooks/kit/, which is
# byte-identical to spinner/hooks/kit/ here, so the kit's own sources
# (claude-code/kit/) would only diff the same files a second time.
/^\(diff --git\|---\|+++\) /{
s# \([ab]\)/claude-code/spinner/# \1/spinner/#g
}
