const AUTH_API_URL='https://script.google.com/macros/s/AKfycbyz7thrApTe2OnKdSJMetrSwzNMwCPJrpPhCCiewkWr2NJPj1KdL3z7lHhlLqOdrb2FNQ/exec';
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
document.querySelector('#newsletter-form')?.addEventListener('submit',e=>{e.preventDefault();showToast('구독 신청이 완료되었습니다.');e.currentTarget.reset()});
function getAuthToken(){return sessionStorage.getItem('blog-auth-token')||localStorage.getItem('blog-auth-token')||''}
function saveAuthToken(token,remember){sessionStorage.removeItem('blog-auth-token');localStorage.removeItem('blog-auth-token');(remember?localStorage:sessionStorage).setItem('blog-auth-token',token)}
function clearAuthToken(){sessionStorage.removeItem('blog-auth-token');localStorage.removeItem('blog-auth-token')}
async function authRequest(payload){
  const response=await fetch(AUTH_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
  const text=await response.text();
  let result;
  try{result=JSON.parse(text)}catch(error){throw new Error('인증 서버에 접근할 수 없습니다. Apps Script 배포 권한을 “모든 사용자”로 설정해 주세요.')}
  if(!result.ok)throw new Error(result.message||'요청을 처리하지 못했습니다.');
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
    saveAuthToken(result.token,Boolean(form.querySelector('input[type="checkbox"]')?.checked));
    const next=new URLSearchParams(location.search).get('next');
    setTimeout(()=>location.href=/^[\w-]+\.html$/.test(next||'')?next:'profile.html',700);
  }catch(error){showToast(error.message);setFormBusy(form,false)}
}));

async function refreshAuthUI(){
  const token=getAuthToken();
  if(document.body.hasAttribute('data-requires-auth')&&!token){location.replace('login.html?next=write.html');return}
  if(!token)return;
  try{
    const result=await authRequest({action:'me',token});
    const actions=document.querySelector('.header-actions');
    if(!actions)return;
    actions.querySelectorAll('a').forEach(link=>link.remove());
    const profile=document.createElement('a');profile.className='text-button';profile.href='profile.html';profile.textContent=result.user.nickname||result.user.name;
    const logout=document.createElement('button');logout.className='mini-button';logout.type='button';logout.textContent='로그아웃';
    logout.addEventListener('click',async()=>{try{await authRequest({action:'logout',token})}catch(error){}clearAuthToken();location.href='index.html'});
    actions.append(profile,logout);
  }catch(error){clearAuthToken();if(document.body.hasAttribute('data-requires-auth'))location.replace('login.html?next=write.html')}
}
if(new URLSearchParams(location.search).get('registered')==='1')setTimeout(()=>showToast('회원가입이 완료되었습니다. 로그인해 주세요.'),100);
refreshAuthUI();
document.querySelector('#write-form')?.addEventListener('submit',e=>{e.preventDefault();const title=document.querySelector('#post-title'),body=document.querySelector('#post-body');if(!title.value.trim()||!body.value.trim()){showToast('제목과 내용을 입력해 주세요.');return}localStorage.setItem('blog-draft',JSON.stringify({title:title.value,category:document.querySelector('#post-category').value,body:body.value,savedAt:new Date().toISOString()}));showToast('게시물이 발행되었습니다.');setTimeout(()=>location.href='index.html',650)});
document.querySelector('#save-draft')?.addEventListener('click',()=>{localStorage.setItem('blog-draft',JSON.stringify({title:document.querySelector('#post-title').value,category:document.querySelector('#post-category').value,body:document.querySelector('#post-body').value,savedAt:new Date().toISOString()}));showToast('임시 저장했습니다.')});
document.querySelectorAll('[data-format]').forEach(button=>button.addEventListener('click',()=>{const area=document.querySelector('#post-body'),map={bold:['**','**'],italic:['_','_'],quote:['> ',''],link:['[링크 텍스트](',')']},[before,after]=map[button.dataset.format],start=area.selectionStart,end=area.selectionEnd;area.setRangeText(before+area.value.slice(start,end)+after,start,end,'select');area.focus()}));
