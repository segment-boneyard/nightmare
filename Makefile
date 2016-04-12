GREP ?=.
#check if xvfb is running
XVFB_RUNNING = $(shell pgrep "Xvfb" > /dev/null; echo $$?)
#set the circle project name if not set
CIRCLE_PROJECT_REPONAME ?= 1
#set headless if not set
HEADLESS ?= 1

#debug the environment variables
$(info $(CIRCLE_PROJECT_REPONAME)$(HEADLESS)$(XVFB_RUNNING))

test: node_modules
#if this build is not on circle, is not headless, and xvfb is not already running,
#run mocha as usual
#otherwise, run mocha under the xvfb wrapper
ifeq ($(CIRCLE_PROJECT_REPONAME)$(HEADLESS)$(XVFB_RUNNING), 111)
	@rm -rf /tmp/nightmare
	@node_modules/.bin/mocha --harmony --grep "$(GREP)"
else
	echo 'running under xvfb wrapper'
	@rm -rf /tmp/nightmare
	@./test/bb-xvfb node_modules/.bin/mocha --harmony --grep "$(GREP)"
endif

node_modules: package.json
	@npm install

.PHONY: test
