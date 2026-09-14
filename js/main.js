const AUTH_API_URL='https://script.google.com/macros/s/AKfycbwjwWZb4e_stgEbgTN29xfNYckZypHDxonGgFnmiYhuURejA_6Ryha6cUb8kWxqkWTtOw/exec';
const AUTH_USER_KEY='blog-auth-user-v1',PUBLIC_POSTS_KEY='blog-public-posts-v1',MY_POSTS_KEY='blog-my-posts-v1';
const AUTH_CACHE_MS=5*60*1000,POST_CACHE_MS=5*60*1000,DETAIL_CACHE_MS=30*60*1000;
function readCache(storage,key,maxAge=Infinity){try{const cached=JSON.parse(storage.getItem(key)||'null');if(!cached||Date.now()-cached.savedAt>maxAge)return null;return cached.value}catch(error){storage.removeItem(key);return null}}
function writeCache(storage,key,value){try{storage.setItem(key,JSON.stringify({savedAt:Date.now(),value}));return true}catch(error){return false}}
function removeCache(storage,key){storage.removeItem(key)}
const root=document.documentElement,menu=document.querySelector('.menu-toggle'),nav=document.querySelector('.nav-list'),theme=document.querySelector('.theme-toggle'),icon=document.querySelector('.theme-icon'),toast=document.querySelector('.toast');
function setTheme(value){root.dataset.theme=value;if(!theme)return;const dark=value==='dark';icon.textContent=dark?'☀':'☾';theme.setAttribute('aria-label',dark?'라이트 모드로 전환':'다크 모드로 전환')}
setTheme(localStorage.getItem('blog-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
theme?.addEventListener('click',()=>{const next=root.dataset.theme==='dark'?'light':'dark';setTheme(next);localStorage.setItem('blog-theme',next)});
menu?.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav.classList.toggle('is-open',!open)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav?.classList.contains('is-open'))menu.click()});
document.querySelectorAll('.nav-list a').forEach(a=>a.addEventListener('click',()=>{menu?.setAttribute('aria-expanded','false');nav?.classList.remove('is-open')}));
const observer=new IntersectionObserver((entries,o)=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');o.unobserve(e.target)}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
document.querySelectorAll('#current-year').forEach(el=>el.textContent=new Date().getFullYear());
function showToast(message){if(!toast)return;toast.textContent=message;toast.classList.add('is-visible');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('is-visible'),2500)}
const search=document.querySelector('#post-search');function filter(){const category=document.querySelector('.category-tabs .is-active')?.dataset.category||'전체',query=search?.value.trim().toLowerCase()||'';let visible=0;document.querySelectorAll('[data-post]').forEach(post=>{const match=(category==='전체'||post.dataset.category===category)&&post.textContent.toLowerCase().includes(query);post.hidden=!match;if(match)visible++});const empty=document.querySelector('.empty-state');if(empty)empty.hidden=visible>0}
document.querySelectorAll('.category-tabs button').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.category-tabs button').forEach(item=>item.classList.remove('is-active'));button.classList.add('is-active');filter()}));search?.addEventListener('input',filter);
function getAuthToken(){return sessionStorage.getItem('blog-auth-token')||localStorage.getItem('blog-auth-token')||''}
function getCachedAuthUser(maxAge=Infinity){return readCache(sessionStorage,AUTH_USER_KEY,maxAge)||readCache(localStorage,AUTH_USER_KEY,maxAge)}
function cacheAuthUser(user){const storage=localStorage.getItem('blog-auth-token')?localStorage:sessionStorage;writeCache(storage,AUTH_USER_KEY,user)}
function saveAuthToken(token,remember,user){sessionStorage.removeItem('blog-auth-token');localStorage.removeItem('blog-auth-token');removeCache(sessionStorage,AUTH_USER_KEY);removeCache(localStorage,AUTH_USER_KEY);const storage=remember?localStorage:sessionStorage;storage.setItem('blog-auth-token',token);if(user)writeCache(storage,AUTH_USER_KEY,user)}
function clearAuthToken(){sessionStorage.removeItem('blog-auth-token');localStorage.removeItem('blog-auth-token');removeCache(sessionStorage,AUTH_USER_KEY);removeCache(localStorage,AUTH_USER_KEY);removeCache(sessionStorage,MY_POSTS_KEY)}
async function authRequest(payload){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  let response;
  try{response=await fetch(AUTH_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:controller.signal})}catch(error){if(error.name==='AbortError')throw new Error('서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.');throw new Error('네트워크 연결을 확인한 후 다시 시도해 주세요.')}finally{clearTimeout(timeout)}
  const text=await response.text();
  let result;
  try{result=JSON.parse(text)}catch(error){throw new Error('블로그 서버에 접근할 수 없습니다. Apps Script 배포 권한을 “모든 사용자”로 설정해 주세요.')}
  if(!result.ok){const error=new Error(result.message||'요청을 처리하지 못했습니다.');error.isApiError=true;throw error}
  return result;
}
function validateAuthForm(form){
  let valid=true;
  form.querySelectorAll('.field-error').forEach(error=>error.textContent='');
  form.querySelectorAll('[required]').forEach(field=>{
    const error=field.closest('.form-group')?.querySelector('.field-error');
    let message='';
    if(field.validity.valueMissing)message=field.type==='checkbox'?'약관에 동의해 주세요.':'필수 입력 항목입니다.';
    else if(field.type==='email'&&!field.validity.valid)message='올바른 이메일을 입력해 주세요.';
    else if(field.dataset.minlength&&field.value.length<Number(field.dataset.minlength))message=`${field.dataset.minlength}자 이상 입력해 주세요.`;
    if(error)error.textContent=message;
    if(message){valid=false;if(field.type==='checkbox')showToast(message)}
  });
  const password=form.querySelector('#password'),confirm=form.querySelector('#password-confirm');
  if(confirm&&password.value!==confirm.value){confirm.closest('.form-group').querySelector('.field-error').textContent='비밀번호가 일치하지 않습니다.';valid=false}
  return valid;
}
function setFormBusy(form,busy){
  const button=form.querySelector('[type="submit"]');
  if(!button)return;
  if(!button.dataset.label)button.dataset.label=button.textContent;
  button.disabled=busy;
  button.textContent=busy?'처리 중...':button.dataset.label;
}
document.querySelectorAll('[data-auth-form]').forEach(form=>form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!validateAuthForm(form))return;
  const action=form.dataset.authForm;
  const payload={action,email:form.querySelector('#email').value.trim(),password:form.querySelector('#password').value};
  if(action==='signup'){payload.name=form.querySelector('#name').value.trim();payload.nickname=form.querySelector('#nickname').value.trim()}
  setFormBusy(form,true);
  try{
    const result=await authRequest(payload);
    showToast(result.message);
    if(action==='signup'){setTimeout(()=>location.href='login.html?registered=1',700);return}
    saveAuthToken(result.token,Boolean(form.querySelector('input[type="checkbox"]')?.checked),result.user);
    const next=new URLSearchParams(location.search).get('next');
    setTimeout(()=>location.href=/^[\w-]+\.html$/.test(next||'')?next:'profile.html',700);
  }catch(error){showToast(error.message);setFormBusy(form,false)}
}));

document.querySelector('#reset-request-form')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if(!form.reportValidity())return;
  const email=document.querySelector('#reset-request-email').value.trim();
  setFormBusy(form,true);
  try{
    const result=await authRequest({action:'requestPasswordReset',email});
    document.querySelector('#reset-email').value=email;
    document.querySelector('#reset-code').focus();
    showToast(result.message);
  }catch(error){showToast(error.message)}finally{setFormBusy(form,false)}
});

document.querySelector('#reset-confirm-form')?.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.currentTarget;
  if(!form.reportValidity())return;
  const password=document.querySelector('#reset-password').value;
  const confirmPassword=document.querySelector('#reset-password-confirm').value;
  if(password!==confirmPassword){showToast('새 비밀번호가 일치하지 않습니다.');return}
  setFormBusy(form,true);
  try{
    const result=await authRequest({action:'confirmPasswordReset',email:document.querySelector('#reset-email').value.trim(),code:document.querySelector('#reset-code').value.trim(),password});
    showToast(result.message);
    setTimeout(()=>location.href='login.html?reset=1',800);
  }catch(error){showToast(error.message);setFormBusy(form,false)}
});

async function refreshAuthUI(){
  const token=getAuthToken();
  const requiresAuth=document.body.hasAttribute('data-requires-auth');
  const actions=document.querySelector('.header-actions');
  if(!actions&&!requiresAuth&&!document.querySelector('#profile-name'))return;

  function renderAuthActions(user){
    if(!actions)return;
    actions.querySelectorAll(':scope > a, :scope > button:not(.theme-toggle)').forEach(element=>element.remove());

    if(!user){
      const login=document.createElement('a');
      login.className='text-button';
      login.href='login.html';
      login.textContent='로그인';
      const signup=document.createElement('a');
      signup.className='mini-button';
      signup.href='signup.html';
      signup.textContent='회원가입';
      actions.append(login,signup);
      return;
    }

    const profile=document.createElement('a');
    profile.className='text-button';
    profile.href='profile.html';
    profile.textContent='프로필';
    const logout=document.createElement('button');
    logout.className='mini-button';
    logout.type='button';
    logout.textContent='로그아웃';
    logout.addEventListener('click',()=>{
      fetch(AUTH_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'logout',token}),keepalive:true}).catch(()=>{});
      clearAuthToken();
      location.href='index.html';
    });
    actions.append(profile,logout);
  }

  if(!token){
    renderAuthActions(null);
    if(requiresAuth){
      const next=location.pathname.split('/').pop()||'index.html';
      location.replace(`login.html?next=${encodeURIComponent(next)}`);
    }
    return;
  }

  const cachedUser=getCachedAuthUser();
  renderAuthActions(cachedUser||{});
  if(cachedUser)renderProfile(cachedUser);
  if(getCachedAuthUser(AUTH_CACHE_MS))return;

  try{
    const result=await authRequest({action:'me',token});
    cacheAuthUser(result.user);
    renderAuthActions(result.user);
    renderProfile(result.user);
  }catch(error){
    const invalidSession=error.isApiError&&/로그인이 필요|세션이 만료|사용자 정보를 찾을 수 없/.test(error.message);
    if(invalidSession){clearAuthToken();renderAuthActions(null);if(requiresAuth){const next=location.pathname.split('/').pop()||'index.html';location.replace(`login.html?next=${encodeURIComponent(next)}`)}}
    else if(!cachedUser)showToast(error.message);
  }
}
function renderProfile(user){
  const name=document.querySelector('#profile-name');if(!name)return;
  const displayName=user.name||user.nickname||'사용자';
  name.textContent=displayName;
  document.querySelector('#profile-heading').textContent=`${displayName}님의 프로필`;
  document.querySelector('#profile-nickname').textContent=user.nickname?`@${user.nickname}`:'';
  document.querySelector('#profile-email').textContent=user.email||'';
  document.querySelector('#profile-created-at').textContent=user.createdAt?`${formatPostDate(user.createdAt)} 가입`:'';
  document.querySelector('#profile-initials').textContent=displayName.trim().slice(0,1).toUpperCase();
}
if(new URLSearchParams(location.search).get('registered')==='1')setTimeout(()=>showToast('회원가입이 완료되었습니다. 로그인해 주세요.'),100);
if(new URLSearchParams(location.search).get('reset')==='1')setTimeout(()=>showToast('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.'),100);
refreshAuthUI();
function formatPostDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'}).format(date)}
function getPostFormData(){return{title:document.querySelector('#post-title').value.trim(),category:document.querySelector('#post-category').value,tags:document.querySelector('#post-tags').value.split(',').map(tag=>tag.trim()).filter(Boolean),summary:document.querySelector('#post-summary').value.trim(),body:document.querySelector('#post-body').value.trim()}}
function fillPostForm(post){document.querySelector('#post-title').value=post.title||'';document.querySelector('#post-category').value=post.category||'개발';document.querySelector('#post-tags').value=(post.tags||[]).join(', ');document.querySelector('#post-summary').value=post.summary||'';document.querySelector('#post-body').value=post.body||''}

const writeForm=document.querySelector('#write-form');
const editingPostId=writeForm?new URLSearchParams(location.search).get('id'):'';
const draftKey=`blog-draft-${editingPostId||'new'}`;
let writeDirty=false,draftTimer;
let draftStatus;
if(writeForm){draftStatus=document.createElement('span');draftStatus.className='draft-status';draftStatus.setAttribute('aria-live','polite');writeForm.querySelector('.write-actions').prepend(draftStatus)}
function saveDraft(showMessage){if(!writeForm)return;const saved=writeCache(localStorage,draftKey,{...getPostFormData(),savedAt:new Date().toISOString()});if(draftStatus)draftStatus.textContent=saved?`임시 저장됨 ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`:'저장 공간이 부족합니다.';if(showMessage)showToast(saved?'임시 저장했습니다.':'임시 저장에 실패했습니다.')}
writeForm?.addEventListener('input',()=>{writeDirty=true;if(draftStatus)draftStatus.textContent='저장 중...';clearTimeout(draftTimer);draftTimer=setTimeout(()=>saveDraft(false),500)});
window.addEventListener('pagehide',()=>{if(writeDirty)saveDraft(false)});
writeForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  const post=getPostFormData();
  if(!post.title||!post.body){showToast('제목과 내용을 입력해 주세요.');return}
  const payload={action:editingPostId?'updatePost':'createPost',token:getAuthToken(),...post};
  if(editingPostId)payload.id=editingPostId;
  setFormBusy(writeForm,true);
  try{
    const result=await authRequest(payload);
    writeDirty=false;clearTimeout(draftTimer);
    localStorage.removeItem(draftKey);
    removeCache(localStorage,PUBLIC_POSTS_KEY);
    removeCache(sessionStorage,MY_POSTS_KEY);
    writeCache(localStorage,`blog-post-${result.post.id}`,result.post);
    showToast(result.message);
    setTimeout(()=>location.href=`post-detail.html?id=${encodeURIComponent(result.post.id)}`,650);
  }catch(error){showToast(error.message);setFormBusy(writeForm,false)}
});
document.querySelector('#save-draft')?.addEventListener('click',()=>saveDraft(true));

async function initializeWriteForm(){
  if(!writeForm)return;
  if(editingPostId){
    const cached=readCache(sessionStorage,MY_POSTS_KEY);
    const cachedPost=cached?.posts?.find(item=>item.id===editingPostId);
    if(cachedPost)fillPostForm(cachedPost);
    document.querySelector('#write-heading').textContent='기록 수정하기';
    document.querySelector('#publish-post').textContent='수정 완료';
    document.title='글 수정 | 기록의 조각';
    if(cachedPost&&readCache(sessionStorage,MY_POSTS_KEY,POST_CACHE_MS))return;
    try{
      const result=await authRequest({action:'myPosts',token:getAuthToken()});
      const post=result.posts.find(item=>item.id===editingPostId);
      if(!post)throw new Error('수정할 게시물을 찾을 수 없습니다.');
      if(!writeDirty)fillPostForm(post);
    }catch(error){showToast(error.message);setTimeout(()=>location.href='profile.html',900)}
    return;
  }
  let draft=readCache(localStorage,draftKey);
  if(!draft){try{draft=JSON.parse(localStorage.getItem('blog-draft')||'null');if(draft){writeCache(localStorage,draftKey,draft);localStorage.removeItem('blog-draft')}}catch(error){localStorage.removeItem('blog-draft')}}
  if(draft){fillPostForm(draft);if(draftStatus)draftStatus.textContent='임시 저장 글을 복원했습니다.'}
}

function createPostCard(post){
  const article=document.createElement('article');article.className='post-card managed-post-card';article.dataset.post='';article.dataset.category=post.category;
  const postHref=`post-detail.html?id=${encodeURIComponent(post.id)}`;
  const visualByCategory={개발:'visual-purple',회고:'visual-green',일상:'visual-orange',책:'visual-blue'};
  const cover=document.createElement('a');cover.className=`card-cover ${visualByCategory[post.category]||'visual-navy'}`;cover.href=postHref;cover.setAttribute('aria-label',`${post.title} 읽기`);
  const coverLabel=document.createElement('strong');coverLabel.textContent=post.category;cover.append(coverLabel);
  const body=document.createElement('div');body.className='card-body';
  const meta=document.createElement('div');meta.className='post-meta';
  const category=document.createElement('span');category.textContent=post.category;const time=document.createElement('time');time.dateTime=post.createdAt;time.textContent=formatPostDate(post.createdAt);meta.append(category,time);
  const heading=document.createElement('h3');const title=document.createElement('a');title.href=cover.href;title.textContent=post.title;heading.append(title);
  const summary=document.createElement('p');summary.textContent=post.summary||post.preview||post.body?.slice(0,90)||'';
  const more=document.createElement('a');more.className='read-more';more.href=cover.href;more.textContent='읽어보기 →';
  body.append(meta,heading,summary,more);article.append(cover,body);
  article.addEventListener('click',event=>{if(!event.target.closest('a'))location.href=postHref});
  return article;
}

function renderPublishedPosts(posts){
  const container=document.querySelector('#published-posts');if(!container)return;
  if(!posts.length){const empty=document.createElement('p');empty.className='posts-loading';empty.textContent='아직 발행된 게시물이 없습니다.';container.replaceChildren(empty);return}
  const grid=document.createElement('div');grid.className='post-grid dynamic-post-grid';posts.forEach(post=>grid.append(createPostCard(post)));container.replaceChildren(grid);filter();
}

async function loadPublishedPosts(){
  const container=document.querySelector('#published-posts');if(!container)return;
  const cached=readCache(localStorage,PUBLIC_POSTS_KEY);
  if(cached)renderPublishedPosts(cached);
  if(readCache(localStorage,PUBLIC_POSTS_KEY,POST_CACHE_MS))return;
  try{
    const result=await authRequest({action:'listPosts'});
    writeCache(localStorage,PUBLIC_POSTS_KEY,result.posts);
    renderPublishedPosts(result.posts);
  }catch(error){if(!cached){const message=document.createElement('p');message.className='posts-load-error';message.textContent=error.message;container.replaceChildren(message)}}
}

function createMyPostRow(post){
  const item=document.createElement('article');item.className='my-post-item';item.dataset.postId=post.id;
  const content=document.createElement('div');
  const meta=document.createElement('p');meta.className='my-post-meta';meta.textContent=`${post.category} · ${formatPostDate(post.createdAt)}`;
  const heading=document.createElement('h3');const link=document.createElement('a');link.href=`post-detail.html?id=${encodeURIComponent(post.id)}`;link.textContent=post.title;heading.append(link);content.append(meta,heading);
  const actions=document.createElement('div');actions.className='my-post-actions';
  const edit=document.createElement('a');edit.className='secondary-button';edit.href=`write.html?id=${encodeURIComponent(post.id)}`;edit.textContent='수정';
  const remove=document.createElement('button');remove.className='danger-button';remove.type='button';remove.dataset.deletePost=post.id;remove.textContent='삭제';actions.append(edit,remove);item.append(content,actions);return item;
}

async function loadMyPosts(){
  const container=document.querySelector('#my-posts');if(!container||!getAuthToken())return;
  const cachedUser=getCachedAuthUser();
  const cached=readCache(sessionStorage,MY_POSTS_KEY);
  const cachedPosts=cached&&cached.ownerId===cachedUser?.id?cached.posts:null;
  const render=posts=>{if(!posts.length){const empty=document.createElement('p');empty.className='list-message';empty.textContent='아직 작성한 글이 없습니다.';container.replaceChildren(empty);return}container.replaceChildren(...posts.map(createMyPostRow))};
  if(cachedPosts)render(cachedPosts);else container.textContent='작성한 글을 불러오는 중입니다.';
  if(cachedPosts&&readCache(sessionStorage,MY_POSTS_KEY,POST_CACHE_MS))return;
  try{
    const result=await authRequest({action:'myPosts',token:getAuthToken()});
    writeCache(sessionStorage,MY_POSTS_KEY,{ownerId:getCachedAuthUser()?.id||'',posts:result.posts});
    render(result.posts);
  }catch(error){if(!cachedPosts)container.textContent=error.message}
}
document.querySelector('#my-posts')?.addEventListener('click',async event=>{
  const button=event.target.closest('[data-delete-post]');if(!button)return;
  if(!confirm('이 글을 삭제하시겠습니까? 삭제한 글은 복구할 수 없습니다.'))return;
  button.disabled=true;
  try{const result=await authRequest({action:'deletePost',token:getAuthToken(),id:button.dataset.deletePost});removeCache(localStorage,PUBLIC_POSTS_KEY);removeCache(sessionStorage,MY_POSTS_KEY);removeCache(localStorage,`blog-post-${button.dataset.deletePost}`);showToast(result.message);button.closest('.my-post-item').remove();if(!document.querySelector('.my-post-item'))loadMyPosts()}catch(error){showToast(error.message);button.disabled=false}
});

function renderPostDetail(post,article){
  document.title=`${post.title} | 기록의 조각`;
  const header=document.createElement('header');header.className='article-header article-wrap';
  const meta=document.createElement('div');meta.className='post-meta';const category=document.createElement('span');category.textContent=post.category;const time=document.createElement('time');time.dateTime=post.createdAt;time.textContent=formatPostDate(post.createdAt);const reading=document.createElement('span');reading.textContent=`${Math.max(1,Math.ceil(post.body.length/500))}분 읽기`;meta.append(category,time,reading);
  const heading=document.createElement('h1');heading.textContent=post.title;const lead=document.createElement('p');lead.className='article-lead';lead.textContent=post.summary;header.append(meta,heading,lead);
  const content=document.createElement('div');content.className='article-wrap article-body dynamic-article-body';const postBody=document.createElement('div');postBody.className='post-content';postBody.textContent=post.body;content.append(postBody);
  if(post.tags.length){const tags=document.createElement('div');tags.className='article-tags';post.tags.forEach(tag=>{const span=document.createElement('span');span.textContent=`#${tag.replace(/^#/,'')}`;tags.append(span)});content.append(tags)}
  const author=document.createElement('aside');author.className='author-box';const initial=document.createElement('div');initial.className='author-initial';const authorText=document.createElement('div');const label=document.createElement('p');label.textContent='작성자';const authorName=document.createElement('h3');authorName.textContent=post.author.nickname||post.author.name||'작성자';initial.textContent=authorName.textContent.trim().slice(0,1).toUpperCase();authorText.append(label,authorName);author.append(initial,authorText);content.append(author);
  article.replaceChildren(header,content);article.removeAttribute('aria-busy');
}

async function loadPostDetail(){
  const article=document.querySelector('#post-detail');const id=new URLSearchParams(location.search).get('id');if(!article)return;
  if(!id){const message=document.createElement('p');message.className='article-load-error';message.textContent='조회할 게시물을 선택해 주세요.';article.replaceChildren(message);return}
  const cacheKey=`blog-post-${id}`;
  const cached=readCache(localStorage,cacheKey);
  if(cached)renderPostDetail(cached,article);else article.setAttribute('aria-busy','true');
  if(readCache(localStorage,cacheKey,DETAIL_CACHE_MS))return;
  try{const {post}=await authRequest({action:'getPost',id});writeCache(localStorage,cacheKey,post);renderPostDetail(post,article)}catch(error){if(!cached){const message=document.createElement('p');message.className='article-load-error';message.textContent=error.message;article.replaceChildren(message)}}
}

initializeWriteForm();
loadPublishedPosts();
loadMyPosts();
loadPostDetail();
document.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>{const area=document.querySelector('#post-body'),map={bold:['**','**'],italic:['_','_'],quote:['> ',''],link:['[링크 텍스트](',')']},[before,after]=map[button.dataset.format],start=area.selectionStart,end=area.selectionEnd;area.setRangeText(before+area.value.slice(start,end)+after,start,end,'select');area.focus()}));
