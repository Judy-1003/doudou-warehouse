import { ensureState } from './services/storage';

App({
  onLaunch() {
    ensureState();
  }
});
