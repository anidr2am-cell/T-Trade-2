# T-Trade Launch Checklist

## Firebase Console

- Authentication: Email/password sign-in is enabled.
- Firestore Database: Created in production mode.
- Storage: Created.
- Firestore Rules: Deploy `firestore.rules`.
- Storage Rules: Deploy `storage.rules`.
- Authorized domains: Add the final hosting domain after deployment.

## Local Project

- `firebase-config.js` points to project `t-t-rade`.
- `firebase.json` is configured for Firebase Hosting.
- `.firebaserc` points to project `t-t-rade`.
- Product images upload to Firebase Storage in live mode.
- Firestore stores image download URLs, not Base64 payloads.

## Smoke Test

- Create a new account.
- Log out and log back in.
- Create a product with at least one photo.
- Open the product detail page.
- Create a second account in another browser/profile.
- Start a chat from the product detail page.
- Send messages from both accounts.
- Verify the product image appears after refresh.
- Verify the chat list appears after refresh.

## Public Launch

- Deploy with `firebase deploy`.
- Open the Firebase Hosting URL on mobile.
- Add the Hosting URL under Firebase Authentication authorized domains if needed.
- Share the public URL only after the smoke test passes.

