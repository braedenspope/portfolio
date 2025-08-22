// Highlight active nav link
const path = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('nav a[data-page]').forEach(a=>{
  if(a.dataset.page === path) a.classList.add('active');
});
