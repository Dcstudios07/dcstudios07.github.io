/* admin.js
 Simple client-side uploader that:
 - asks admin for PAT (prompt)
 - uploads image to repo path img/
 - appends a project-card HTML snippet into project.html (inside container)
 - lists existing projects by parsing project.html (naive)
 NOTE: Repo owner/name are hard-coded for your repo.
*/

const OWNER = 'Dcstudios07';
const REPO = 'dcstudios07.github.io';
const BRANCH = 'main'; // change if your default branch is different

let GITHUB_TOKEN = null;

document.getElementById('enterTokenBtn').addEventListener('click', ()=> {
  const t = prompt('Enter GitHub Personal Access Token (Contents: Read & Write for repo).');
  if(t && t.trim().length>10) {
    GITHUB_TOKEN = t.trim();
    document.getElementById('tokenStatus').innerText = 'Token: set (session)';
    log('Token set for this session.');
    listProjects();
  } else {
    alert('Token not set or invalid.');
  }
});

document.getElementById('addBtn').addEventListener('click', async ()=>{
  if(!GITHUB_TOKEN) { alert('Please enter GitHub token first.'); return; }
  const title = document.getElementById('title').value.trim();
  const desc = document.getElementById('desc').value.trim();
  const video = document.getElementById('video').value.trim();
  const fileInput = document.getElementById('thumb');
  if(!title) { alert('Please enter title'); return; }
  if(!fileInput.files || fileInput.files.length===0) { if(!confirm('No image selected. Continue with video-only project?')) return; }

  const id = 'proj-' + Date.now();
  let imgPath = '';

  if(fileInput.files && fileInput.files.length>0) {
    const file = fileInput.files[0];
    const ext = file.name.split('.').pop().toLowerCase();
    const filename = `${id}.${ext}`;
    imgPath = `img/${filename}`;
    log('Uploading image to ' + imgPath + ' ...');
    const b64 = await fileToBase64(file);
    const res = await githubPutFile(imgPath, b64, `Add project image ${filename}`);
    if(res && res.content && res.content.path) {
      log('Image uploaded: ' + res.content.path);
    } else {
      log('Image upload failed', true); return;
    }
  }

  // Build HTML snippet consistent with your project's markup.
  // Adjust the markup if your project.html uses different classes.
  const thumbHtml = imgPath ? `<img src="${imgPath}" alt="${escapeHtml(title)}" />` : '';
  const videoHtml = video ? `<a href="${escapeHtml(video)}" target="_blank">View Video</a>` : '';
  const snippet = `
  <div class="project-item" data-id="${id}">
    <div class="thumb">${thumbHtml}</div>
    <div class="meta">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
      <p>${videoHtml}</p>
    </div>
    <button class="delete-btn" data-id="${id}">Delete</button>
  </div>
  `;

  // Append snippet to project.html
  const updateOk = await appendSnippetToProjectHtml(snippet, `Add project ${title}`);
  if(updateOk) {
    log('Project added to project.html');
    clearForm();
    listProjects();
  } else {
    log('Failed to update project.html', true);
  }
});

document.getElementById('refreshBtn').addEventListener('click', ()=> listProjects());

async function fileToBase64(file) {
  return await new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(',')[1];
      res(b64);
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

async function githubGetFile(path) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }});
  if(r.status===200) return r.json();
  return null;
}

async function githubPutFile(path, base64Content, message, sha=null) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  const body = { message: message || 'Admin upload', content: base64Content, branch: BRANCH };
  if(sha) body.sha = sha;
  const r = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  });
  return r.json();
}

function b64EncodeUnicode(str) {
  // unicode-safe base64
  return btoa(unescape(encodeURIComponent(str)));
}

function b64DecodeUnicode(str) {
  return decodeURIComponent(escape(atob(str)));
}

async function appendSnippetToProjectHtml(snippet, commitMessage) {
  const path = 'project.html';
  const file = await githubGetFile(path);
  if(!file) { log('Could not fetch project.html', true); return false; }
  const sha = file.sha;
  const content = b64DecodeUnicode(file.content.replace(/\n/g,''));
  // Try to find marker <!-- project-list-end --> else append before </body>
  let newContent;
  if(content.includes('<!-- project-list-end -->')) {
    newContent = content.replace('<!-- project-list-end -->', snippet + '\n<!-- project-list-end -->');
  } else if(content.includes('</body>')) {
    // append before </body>
    newContent = content.replace('</body>', snippet + '\n</body>');
  } else {
    newContent = content + '\n' + snippet;
  }
  const bodyB64 = b64EncodeUnicode(newContent);
  const res = await githubPutFile(path, bodyB64, commitMessage, sha);
  if(res && res.content) return true;
  return false;
}

function escapeHtml(s) {
  return (s+'').replace(/[&<>"'`]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c]));
}

async function listProjects() {
  const cont = document.getElementById('projectsList');
  cont.innerHTML = 'Loading...';
  const file = await githubGetFile('project.html');
  if(!file) { cont.innerHTML = 'project.html not found or cannot read. Enter token and ensure Contents permission.'; return; }
  const html = b64DecodeUnicode(file.content.replace(/\n/g,''));
  // naive parse: find all occurrences of <div class="project-item" ...> ... </div>
  const items = [...html.matchAll(/<div[^>]*class="project-item"[\s\S]*?<\/div>\s*<\/div>|\<div[^>]*class="project-item"[\s\S]*?<\/div>/g)];
  // simpler: split by data-id
  const nodes = [...html.matchAll(/<div[^>]*data-id="(proj-[0-9]+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>|<div[^>]*data-id="(proj-[0-9]+)"[^>]*>([\s\S]*?)<\/div>/g)];
  // fallback: try to find project-item blocks
  const blocks = [...html.matchAll(/<div[^>]*class="project-item"[^>]*>[\s\S]*?<\/div>\s*<\/div>|<div[^>]*class="project-item"[^>]*>[\s\S]*?<\/div>/g)];
  cont.innerHTML = '';
  if(blocks.length===0) { cont.innerHTML = '<div class="text-muted">No projects found (project.html has no recognizable project-item blocks).</div>'; return; }
  blocks.forEach((m, idx) => {
    const block = m[0];
    // extract data-id if present
    const idMatch = block.match(/data-id="(proj-[0-9]+)"/);
    const id = idMatch ? idMatch[1] : ('local-'+idx);
    // extract title (h3)
    const titleMatch = block.match(/<h3[^>]*>(.*?)<\/h3>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g,'') : 'Untitled';
    const li = document.createElement('div');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    li.innerHTML = `<div><strong>${title}</strong><div class="small text-muted">${id}</div></div>
      <div><button class="btn btn-sm btn-danger" data-id="${id}">Delete</button></div>`;
    cont.appendChild(li);
    li.querySelector('button').addEventListener('click', ()=> deleteProjectById(id));
  });
}

async function deleteProjectById(id) {
  if(!confirm('Delete project ' + id + ' from project.html?')) return;
  if(!GITHUB_TOKEN) { alert('Enter token'); return; }
  const path = 'project.html';
  const file = await githubGetFile(path);
  if(!file) { log('Could not read project.html', true); return; }
  const sha = file.sha;
  const html = b64DecodeUnicode(file.content.replace(/\n/g,''));
  // remove the first block containing data-id="id"
  const newHtml = html.replace(new RegExp(`<div[^>]*data-id="${id}"[\\s\\S]*?<\\/div>\\s*<\\/div>`, 'i'), '');
  const bodyB64 = b64EncodeUnicode(newHtml);
  const res = await githubPutFile(path, bodyB64, `Delete project ${id}`, sha);
  if(res && res.content) {
    log('Deleted project from project.html');
    listProjects();
  } else {
    log('Failed to delete', true);
  }
}

function log(msg, isError=false) {
  const l = document.getElementById('log');
  const node = document.createElement('div');
  node.innerText = (new Date().toLocaleTimeString()) + ' — ' + msg;
  if(isError) node.style.color = 'crimson';
  l.prepend(node);
}

function clearForm() {
  document.getElementById('title').value='';
  document.getElementById('desc').value='';
  document.getElementById('video').value='';
  document.getElementById('thumb').value = null;
}
