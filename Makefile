GREP ?=.

test: node_modules
	@node_modules/.bin/mocha --harmony --grep "$(GREP)"

node_modules: package.json
	@npm install

.PHONY: test