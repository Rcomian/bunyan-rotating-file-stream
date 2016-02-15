
#---- Tools

NODEUNIT := ./node_modules/.bin/nodeunit
SUDO := sudo
ifeq ($(shell uname -s),SunOS)
	# On SunOS (e.g. SmartOS) we expect to run the test suite as the
	# root user -- necessary to run dtrace. Therefore `pfexec` isn't
	# necessary.
	SUDO :=
endif
DTRACE_UP_IN_HERE=
ifeq ($(shell uname -s),SunOS)
    DTRACE_UP_IN_HERE=1
endif
ifeq ($(shell uname -s),Darwin)
    DTRACE_UP_IN_HERE=1
endif
NODEOPT ?= $(HOME)/opt



#---- Files

JSSTYLE_FILES := $(shell find lib tools -name "*.js")



#---- Targets

all $(NODEUNIT):
	npm install $(NPM_INSTALL_FLAGS)

# Ensure all version-carrying files have the same version.
.PHONY: versioncheck
versioncheck:
	@echo version is: $(shell cat package.json | json version)
	[[ `cat package.json | json version` == `grep '^## ' CHANGES.md | head -1 | awk '{print $$2}'` ]]
	@echo Version check ok.

.PHONY: cutarelease
cutarelease: versioncheck check
	[[ `git status | tail -n1 | cut -c1-17` == "nothing to commit" ]]
	./tools/cutarelease.py -p bunyan -f package.json -f lib/index.js

.PHONY: publish
publish:
	mkdir -p tmp
	[[ -d tmp/bunyan-gh-pages ]] || git clone git@github.com:trentm/node-bunyan.git tmp/bunyan-gh-pages
	cd tmp/bunyan-gh-pages && git checkout gh-pages && git pull --rebase origin gh-pages
	cp docs/index.html tmp/bunyan-gh-pages/index.html
	cp docs/bunyan.1.html tmp/bunyan-gh-pages/bunyan.1.html
	(cd tmp/bunyan-gh-pages \
		&& git commit -a -m "publish latest docs" \
		&& git push origin gh-pages || true)

.PHONY: distclean
distclean:
	rm -rf node_modules

#---- check

.PHONY: check-jsstyle
check-jsstyle: $(JSSTYLE_FILES)
	./tools/jsstyle -o indent=4,doxygen,unparenthesized-return=0,blank-after-start-comment=0,leading-right-paren-ok=1 $(JSSTYLE_FILES)

.PHONY: check
check: check-jsstyle
	@echo "Check ok."

.PHONY: prepush
prepush: check
	@echo "Okay to push."
