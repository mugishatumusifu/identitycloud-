<template>
  <div class="not-found">
    <div class="nf-card glass-card fade-up">
      <div class="nf-code">404</div>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <a href="/" class="nf-btn">← Go Home</a>
    </div>
  </div>
</template>

<style scoped>
.not-found { display: flex; justify-content: center; align-items: center; min-height: 50vh; }
.nf-card {
  padding: 60px 48px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.nf-code {
  font-family: var(--font-mono);
  font-size: 5rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-2), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}
h2 { font-size: 1.4rem; }
p  { color: var(--text-secondary); font-size: 0.95rem; }
.nf-btn {
  margin-top: 8px;
  display: inline-block;
  padding: 10px 22px;
  background: var(--accent);
  color: #fff;
  border-radius: 10px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.2s;
}
.nf-btn:hover { background: var(--accent-2); text-decoration: none; }
</style>
