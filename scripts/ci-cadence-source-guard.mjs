/** Emitted before/after APP work: no candidate module or shell startup file is
 * imported. Fixed absolute Git/Python and raw physical bytes ignore index hints. */
export const SOURCE_SHELL='/usr/bin/env -u BASH_ENV -u ENV -u SHELLOPTS -u BASHOPTS -u LD_PRELOAD -u LD_LIBRARY_PATH /bin/bash --noprofile --norc -p -e -o pipefail {0}';
export const SOURCE_ENV=Object.fromEntries(['BASH_ENV','ENV','LD_PRELOAD','LD_LIBRARY_PATH','LD_AUDIT','LD_ORIGIN_PATH','DYLD_INSERT_LIBRARIES','DYLD_LIBRARY_PATH','PYTHONPATH','PYTHONHOME','PYTHONSTARTUP'].map(key=>[key,'']));
export const SOURCE_GUARD=`set -euo pipefail
/usr/bin/python3 -I - <<'PY'
import os,re,stat,subprocess,hashlib
from pathlib import Path
root=Path.cwd().resolve()
expected=os.environ.get('SOURCE_SHA','')
assert re.fullmatch('[a-f0-9]{40}',expected) and expected!='0'*40
metadata=root/'.git'
assert metadata.is_dir() and not metadata.is_symlink()
env={'PATH':'/usr/bin:/bin','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_NO_REPLACE_OBJECTS':'1','GIT_GRAFT_FILE':'/dev/null'}
def git(*args):
 return subprocess.check_output(['/usr/bin/git','--no-replace-objects','--git-dir='+str(metadata),'--work-tree='+str(root),'-c','core.useReplaceRefs=false','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','core.ignoreCase=false','-c','core.attributesFile=/dev/null',*args],cwd=root,env=env,timeout=10)
assert git('rev-parse','--show-object-format').strip()==b'sha1'
assert git('rev-parse','--verify','HEAD').strip().decode()==expected
assert not (metadata/'info/grafts').exists()
assert not git('for-each-ref','--format=%(refname)','refs/replace').strip()
committed={}
for entry in git('ls-tree','-rz','--full-tree',expected).split(b'\\0'):
 if not entry:continue
 fields,name=entry.split(b'\\t',1);mode,kind,oid=fields.split()
 assert kind==b'blob' and mode in (b'100644',b'100755',b'120000')
 assert name and not name.startswith(b'/') and all(part not in (b'',b'.',b'..',b'.git') for part in name.split(b'/'))
 committed[name]=(mode,oid)
index={}
for entry in git('ls-files','--stage','-z').split(b'\\0'):
 if not entry:continue
 fields,name=entry.split(b'\\t',1);mode,oid,stage=fields.split()
 assert stage==b'0' and name not in index
 index[name]=(mode,oid)
assert committed==index
for entry in git('ls-files','-v','-z').split(b'\\0'):
 if entry:assert entry[:2]==b'H '
assert not git('ls-files','--others','--exclude-standard','-z')
for name,(mode,oid) in committed.items():
 path=root/os.fsdecode(name)
 parent=path.parent
 while parent!=root:
  assert parent.is_dir() and not parent.is_symlink();parent=parent.parent
 before=path.lstat()
 if mode==b'120000':
  assert stat.S_ISLNK(before.st_mode);data=os.fsencode(os.readlink(path))
 else:
  assert stat.S_ISREG(before.st_mode) and before.st_nlink==1 and bool(before.st_mode&0o111)==(mode==b'100755') and before.st_size<=134217728
  with open(path,'rb') as source:data=source.read(134217729)
  assert len(data)==before.st_size
 after=path.lstat()
 assert (before.st_dev,before.st_ino,before.st_mode,before.st_size,before.st_mtime_ns)==(after.st_dev,after.st_ino,after.st_mode,after.st_size,after.st_mtime_ns)
 assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\\0'+data).hexdigest().encode()==oid
assert git('rev-parse','--verify','HEAD').strip().decode()==expected
PY
`;
