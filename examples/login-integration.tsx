// Example usage in CustomLoginForm.tsx
import { useChatbotAuth } from '../contexts/ChatbotAuthContext';

// Inside the component:
const { signIn, signUp, requireAuth, canAccessChat, userProfile } = useChatbotAuth();

// Modified handleSignInWithEmail function:
const handleSignInWithEmail = async () => {
  try {
    setIsSubmitting(true);
    
    // Use chatbot-scoped authentication
    const result = await signIn(email, password);
    
    if (result.success) {
      console.log('✅ Signed in successfully');
      // User will see their original email in the profile
      router.push('/');
    } else {
      setErrorMessage(result.error || 'Login failed');
    }
  } catch (error: any) {
    setErrorMessage(error.message);
  } finally {
    setIsSubmitting(false);
  }
};

// Modified handleSignUpWithEmail function:
const handleSignUpWithEmail = async () => {
  try {
    setIsSubmitting(true);
    
    // Use chatbot-scoped authentication  
    const result = await signUp(email, password, email);
    
    if (result.success) {
      console.log('✅ Signed up successfully');
      // User profile will show original email: john@email.com
      // But Firebase Auth uses: john@email.com_chatbot-A@chatbot.local
      router.push('/');
    } else {
      setErrorMessage(result.error || 'Signup failed');
    }
  } catch (error: any) {
    setErrorMessage(error.message);
  } finally {
    setIsSubmitting(false);
  }
};

// In the UI, user sees their original email:
// Profile: {userProfile?.originalEmail} (shows: john@email.com)
// NOT: {user?.email} (would show: john@email.com_chatbot-A@chatbot.local)
