# pcvelz/superpowers paths -> superpowers/. Only skills, hooks and docs are tracked.
/^\(diff --git\|---\|+++\) /{
s# \([ab]\)/# \1/superpowers/#g
}
