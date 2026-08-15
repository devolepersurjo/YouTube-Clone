import { auth, db } from '../config/firebase-config.js';

class AuthService {
  constructor() {
    this.googleClientId = "592717879868-mjtav3e9tuhct7j64tsr0p0ea5q8simj.apps.googleusercontent.com";
    this.authListeners = [];
    this.currentUser = this._getLocalUser();

    this._ensurePersistence();
    this._initAuthListener();
    this._initGoogleIdentityServices();
  }

  _getLocalUser() {
    try {
      const saved = localStorage.getItem('ytclone_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  _setLocalUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('ytclone_auth_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ytclone_auth_user');
    }
    this.authListeners.forEach((callback) => callback(this.currentUser));
  }

  async _ensurePersistence() {
    try {
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    } catch (e) {
      console.warn('Firebase persistence warning:', e);
    }
  }

  _initAuthListener() {
    auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const userObj = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
          photoURL: firebaseUser.photoURL || ''
        };
        this._setLocalUser(userObj);
      } else if (!this.currentUser) {
        this._setLocalUser(null);
      }
    });
  }

  onAuthStateChanged(callback) {
    this.authListeners.push(callback);
    callback(this.currentUser);
  }

  _initGoogleIdentityServices() {
    const checkGsi = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: this.googleClientId,
            callback: (response) => this.handleGoogleCredentialResponse(response),
            auto_select: false,
            cancel_on_tap_outside: true
          });
        } catch (err) {}
      } else {
        setTimeout(checkGsi, 200);
      }
    };
    checkGsi();
  }

  _decodeJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  async handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      window.dispatchEvent(new CustomEvent('google-signin-failed', { detail: { message: 'Google sign-in was cancelled.' } }));
      return;
    }

    const payload = this._decodeJwt(response.credential);
    if (!payload) {
      window.dispatchEvent(new CustomEvent('google-signin-failed', { detail: { message: 'Invalid Google credential token.' } }));
      return;
    }

    const currentMode = window.__authCurrentMode || 'login';
    const email = payload.email;

    try {
      // Check if email is already in database
      const emailQuery = await db.ref('users').orderByChild('profile/email').equalTo(email).once('value');
      const exists = emailQuery.exists();

      if (currentMode === 'register' && exists) {
        window.dispatchEvent(new CustomEvent('google-signin-failed', { 
          detail: { message: 'This Google account is already registered. Please sign in from the Login tab.' } 
        }));
        return;
      }

      const activeUser = {
        uid: payload.sub,
        email: payload.email || '',
        displayName: payload.name || payload.email.split('@')[0],
        photoURL: payload.picture || '',
        authMethod: 'google'
      };

      try {
        const credential = firebase.auth.GoogleAuthProvider.credential(response.credential);
        const userCredential = await auth.signInWithCredential(credential);
        activeUser.uid = userCredential.user.uid;
      } catch (e) {}

      this._setLocalUser(activeUser);
      await this._syncUserProfile(activeUser, 'google');

      window.dispatchEvent(new CustomEvent('google-signin-success', { detail: { user: activeUser, payload } }));

    } catch (err) {
      window.dispatchEvent(new CustomEvent('google-signin-failed', { detail: { message: err.message } }));
    }
  }

  triggerGooglePrompt(mode = 'login') {
    window.__authCurrentMode = mode;
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          this._fallbackGooglePopup(mode);
        }
      });
    } else {
      this._fallbackGooglePopup(mode);
    }
  }

  async _fallbackGooglePopup(mode = 'login') {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const user = result.user;

      const activeUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL || '',
        authMethod: 'google'
      };

      this._setLocalUser(activeUser);
      await this._syncUserProfile(activeUser, 'google');
      window.dispatchEvent(new CustomEvent('google-signin-success', { detail: { user: activeUser } }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('google-signin-failed', { detail: { message: e.message } }));
    }
  }

  async _syncUserProfile(user, authMethod = 'password') {
    if (!user || !user.uid) return;
    try {
      const userRef = db.ref(`users/${user.uid}/profile`);
      const snapshot = await userRef.once('value');
      if (!snapshot.exists()) {
        await userRef.set({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'YouTube User',
          photoURL: user.photoURL || '',
          authMethod: authMethod,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
      } else {
        await userRef.update({ 
          photoURL: user.photoURL || '',
          displayName: user.displayName || 'YouTube User'
        });
      }
    } catch (e) {}
  }

  async sendPasswordReset(email) {
    if (!email || !email.trim()) {
      throw new Error('Please enter your email in the box first.');
    }
    try {
      await auth.sendPasswordResetEmail(email.trim());
      return true;
    } catch (error) {
      throw new Error(this.getFriendlyErrorMessage(error));
    }
  }

  getFriendlyErrorMessage(error) {
    if (!error) return 'An unknown error occurred.';
    const code = error.code || '';
    switch (code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'Wrong password. Please check your password and try again.';
      case 'auth/user-not-found':
        return 'No account found with this email. Please sign up first.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email address.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password is too weak. Must be at least 6 characters.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      default:
        return error.message ? error.message.replace('Firebase: ', '') : 'Authentication failed.';
    }
  }

  async register(email, password, displayName) {
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      await user.updateProfile({
        displayName: displayName || email.split('@')[0]
      });

      const userObj = {
        uid: user.uid,
        email: user.email,
        displayName: displayName || email.split('@')[0],
        photoURL: '',
        authMethod: 'password'
      };

      this._setLocalUser(userObj);
      await this._syncUserProfile(userObj, 'password');
      return user;
    } catch (error) {
      throw new Error(this.getFriendlyErrorMessage(error));
    }
  }

  // Exact Method Detection (Screenshot 7 & 8 Logic Fix)
  async login(email, password) {
    // 1. Check if user signed up with Google in Firebase
    try {
      const methods = await auth.fetchSignInMethodsForEmail(email);
      const checkRef = await db.ref('users').orderByChild('profile/email').equalTo(email).once('value');
      
      let isGoogleOnly = methods.includes('google.com') && !methods.includes('password');

      if (!isGoogleOnly && checkRef.exists()) {
        const uData = Object.values(checkRef.val())[0];
        if (uData.profile?.authMethod === 'google') {
          isGoogleOnly = true;
        }
      }

      if (isGoogleOnly) {
        throw new Error('Wrong password. If you signed up with Google, use Forgot Password to set a password.');
      }
    } catch (err) {
      if (err.message.includes('signed up with Google')) throw err;
    }

    // 2. Normal Email/Password Login
    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      const userObj = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email.split('@')[0],
        photoURL: user.photoURL || '',
        authMethod: 'password'
      };

      this._setLocalUser(userObj);
      return user;
    } catch (error) {
      throw new Error(this.getFriendlyErrorMessage(error));
    }
  }

  async logout() {
    this._setLocalUser(null);
    try {
      await auth.signOut();
    } catch (e) {}
  }
}

export const authService = new AuthService();
