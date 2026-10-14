// Git exports GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE and similar variables to hooks.
// A test run started from a hook would point every fixture `git` call at the hook's
// repository. Import this module first so no module or child process inherits them.
for (const name of Object.keys(process.env)) if (name.startsWith('GIT_')) delete process.env[name];
