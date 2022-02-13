PACKAGE=touchpad-indicator

GETTEXT_PACKAGE = $(PACKAGE)
UUID = $(PACKAGE)@orangeshirt

DOC_FILES=README.md
SRC_FILES=extension.js prefs.js lib.js synclient.js xinput.js Settings.ui
MO_FILE=hi/LC_MESSAGES/$(GETTEXT_PACKAGE).mo
SCHEMA_FILES=schemas/gschemas.compiled schemas/org.gnome.shell.extensions.touchpad-indicator.gschema.xml
EXTENSION_FILES=metadata.json
OUTPUT=$(DOC_FILES) $(SRC_FILES) $(MO_FILES) $(SCHEMA_FILES) $(EXTENSION_FILES)
POT_FILE=hi/$(GETTEXT_PACKAGE).pot
LOCAL_INSTALL=~/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: pack update-po install enable disable reload help

pack: $(OUTPUT) ## Pack sources for install.
	zip $(UUID).zip $(OUTPUT)

$(POT_FILE): $(SRC_FILES) ## generate gettext pot file.
	mkdir -p po
	xgettext -d $(GETTEXT_PACKAGE) -o $@ $(SRC_FILES) --from-code=UTF-8

update-po: $(POT_FILE) ## Update gettext po files.
	for lang in $(LANGUAGES); do \
		msgmerge -U po/$$lang.po $(POT_FILE); \
	done

locale/%/LC_MESSAGES/$(PACKAGE).mo: po/%.po  ## Generate gettext-compiled mo file.
	mkdir -p `dirname $@`
	msgfmt $< -o $@

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.touchpad-indicator.gschema.xml  ## Compile gschemas.
	glib-compile-schemas  schemas

install: pack  ## Install extension in user space.
	mkdir -p $(LOCAL_INSTALL)
	rm -rf $(LOCAL_INSTALL)
	unzip $(UUID).zip -d $(LOCAL_INSTALL)

enable: ## Enable extension in gnome-shell.
	gnome-extensions enable $(UUID)

disable: ## Disable extension in gnome-shell.
	gnome-extensions disable $(UUID)

reload: ## Reload extension.
	gnome-extensions reset $(UUID)

help: ## Show this help.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf " \033[36m%-30s\033[0m %s\n", $$1, $$2}'