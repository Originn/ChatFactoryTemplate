import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';

interface ChatbotSignupData {
  email: string;
  password: string;
  displayName?: string;
}

interface ChatbotUserProfile {
  originalEmail: string;
  displayName: string;
  chatbotId: string;
  chatbotName: string;
  createdAt: any;
  lastLoginAt: any;
}

export class ChatbotAuthService {
  
  /**
   * Create a scoped email for this specific chatbot
   */
  private static createScopedEmail(email: string, chatbotId: string): string {
    // Create a scoped email that's unique to this chatbot
    // Format: original-email_chatbot-id@chatbot.local
    const [localPart, domain] = email.split('@');
    return `${localPart}_${domain}_${chatbotId}@chatbot.local`;
  }

  /**
   * Register a new user for this specific chatbot
   */
  static async registerUser(signupData: ChatbotSignupData): Promise<{
    success: boolean;
    user?: any;
    error?: string;
  }> {
    try {
      const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
      const chatbotName = process.env.NEXT_PUBLIC_CHATBOT_NAME || 'AI Assistant';
      
      if (!chatbotId) {
        throw new Error('Chatbot ID not configured');
      }

      console.log('🔐 Registering user for chatbot:', {
        originalEmail: signupData.email,
        chatbotId,
        chatbotName
      });

      // Create scoped email for Firebase Auth
      const scopedEmail = this.createScopedEmail(signupData.email, chatbotId);
      
      console.log('📧 Using scoped email for Firebase Auth:', scopedEmail);

      // Create user with scoped email
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        scopedEmail, 
        signupData.password
      );

      const user = userCredential.user;

      // Update the display name to show original email
      await updateProfile(user, {
        displayName: signupData.displayName || signupData.email
      });

      // Create user profile document with original email
      const userProfile: ChatbotUserProfile = {
        originalEmail: signupData.email,
        displayName: signupData.displayName || signupData.email,
        chatbotId: chatbotId,
        chatbotName: chatbotName,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      };

      // Store in Firestore with original email visible
      await setDoc(doc(db, 'chatbot_users', user.uid), userProfile);

      console.log('✅ User registered successfully:', {
        uid: user.uid,
        originalEmail: signupData.email,
        chatbotId
      });

      return { success: true, user };

    } catch (error: any) {
      console.error('❌ Registration failed:', error);
      return { 
        success: false, 
        error: error.message || 'Registration failed' 
      };
    }
  }

  /**
   * Sign in user with their original email
   */
  static async loginUser(email: string, password: string): Promise<{
    success: boolean;
    user?: any;
    error?: string;
  }> {
    try {
      const chatbotId = process.env.NEXT_PUBLIC_CHATBOT_ID;
      
      if (!chatbotId) {
        throw new Error('Chatbot ID not configured');
      }

      // Convert to scoped email for Firebase Auth
      const scopedEmail = this.createScopedEmail(email, chatbotId);
      
      console.log('🔐 Logging in user:', {
        originalEmail: email,
        scopedEmail: scopedEmail,
        chatbotId
      });

      const userCredential = await signInWithEmailAndPassword(auth, scopedEmail, password);
      
      // Update last login time
      await setDoc(doc(db, 'chatbot_users', userCredential.user.uid), {
        lastLoginAt: serverTimestamp()
      }, { merge: true });

      return { success: true, user: userCredential.user };

    } catch (error: any) {
      console.error('❌ Login failed:', error);
      return { 
        success: false, 
        error: error.code === 'auth/user-not-found' 
          ? 'No account found with this email for this chatbot' 
          : error.message || 'Login failed' 
      };
    }
  }

  /**
   * Get user profile with original email
   */
  static async getUserProfile(uid: string): Promise<ChatbotUserProfile | null> {
    try {
      const docRef = doc(db, 'chatbot_users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return docSnap.data() as ChatbotUserProfile;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to get user profile:', error);
      return null;
    }
  }
}
