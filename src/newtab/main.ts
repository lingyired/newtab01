import '../../styles/globals.css';
import { initApp } from './app';

let bootstrapped = false;

function bootstrap(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void initApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}

console.log('newtab01 newtab loaded');
