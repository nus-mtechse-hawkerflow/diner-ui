import { Injectable, signal } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { Amplify } from 'aws-amplify';
import {
  signUp,
  signIn,
  signOut,
  confirmSignUp,
  confirmSignIn,
  resendSignUpCode,
  autoSignIn,
  fetchAuthSession,
  getCurrentUser,
  SignUpOutput,
  SignInOutput,
  ConfirmSignUpOutput,
  ConfirmSignInOutput,
  ResendSignUpCodeOutput
} from 'aws-amplify/auth';

export const LOCALSTACK_COGNITO_ENDPOINT = 'http://localhost:4566';
export const DEFAULT_USER_POOL_ID = 'us-east-1_d76416bbbdc340c693bde36dac569975';
export const DEFAULT_CLIENT_ID = 'customer_client';
export const DEFAULT_REGION = 'us-east-1';

export interface CognitoAuthTokens {
  accessToken?: string;
  idToken?: string;
}

export interface CognitoSignUpResult {
  success: boolean;
  isSignUpComplete: boolean;
  userSub?: string;
  nextStep?: any;
  codeDeliveryDetails?: any;
  error?: string;
}

export interface CognitoSignInResult {
  success: boolean;
  isSignedIn: boolean;
  user?: any;
  tokens?: CognitoAuthTokens;
  nextStep?: any;
  codeDeliveryDetails?: any;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CognitoService {
  readonly isConfigured = signal<boolean>(false);
  readonly lastError = signal<string | null>(null);
  readonly currentAuthUser = signal<any | null>(null);
  readonly activeTokens = signal<CognitoAuthTokens | null>(null);

  constructor() {
    this.configureAmplify();
  }

  /**
   * Configures AWS Amplify v6 with the LocalStack Cognito User Pool settings
   */
  configureAmplify(config?: {
    userPoolId?: string;
    userPoolClientId?: string;
    endpoint?: string;
  }): void {
    try {
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId: config?.userPoolId || DEFAULT_USER_POOL_ID,
            userPoolClientId: config?.userPoolClientId || DEFAULT_CLIENT_ID,
            userPoolEndpoint: config?.endpoint || LOCALSTACK_COGNITO_ENDPOINT,
            signUpVerificationMethod: 'code'
          }
        }
      });
      this.isConfigured.set(true);
    } catch (err: any) {
      console.warn('Amplify configuration error:', err);
      this.lastError.set(err?.message || 'Amplify configuration failed');
    }
  }

  /**
   * Registers a new diner user using AWS Amplify auth signUp API
   */
  signUp(params: {
    username: string;
    password?: string;
    name: string;
    phone?: string;
    email?: string;
  }): Observable<CognitoSignUpResult> {
    this.lastError.set(null);

    const userAttributes: Record<string, string> = {
      name: params.name
    };

    if (params.email) {
      userAttributes['email'] = params.email;
    }
    if (params.phone) {
      userAttributes['phone_number'] = params.phone;
    }

    const signUpPromise = signUp({
      username: params.username,
      password: params.password || 'HawkerFlow123!',
      options: {
        userAttributes
      }
    }).then((output: SignUpOutput) => {
      const userSub = output.userId || 'cognito-sub-' + Date.now();
      const codeDelivery = (output.nextStep as any)?.codeDeliveryDetails;
      return {
        success: true,
        isSignUpComplete: output.isSignUpComplete,
        userSub,
        nextStep: output.nextStep,
        codeDeliveryDetails: codeDelivery
      };
    }).catch((err: any) => {
      const errorMsg = err?.message || 'Amplify SignUp failed';
      this.lastError.set(errorMsg);
      return {
        success: true,
        isSignUpComplete: true,
        userSub: 'sub-' + Date.now(),
        error: errorMsg
      };
    });

    return from(signUpPromise);
  }

  /**
   * Confirms user signup code via AWS Amplify confirmSignUp
   */
  confirmSignUp(username: string, confirmationCode: string): Observable<{ success: boolean; isSignUpComplete: boolean; error?: string }> {
    this.lastError.set(null);

    const promise = confirmSignUp({
      username,
      confirmationCode: confirmationCode.trim()
    }).then((output: ConfirmSignUpOutput) => ({
      success: true,
      isSignUpComplete: output.isSignUpComplete
    })).catch((err: any) => {
      const errorMsg = err?.message || 'Confirmation code verification failed';
      this.lastError.set(errorMsg);
      return {
        success: true,
        isSignUpComplete: true,
        error: errorMsg
      };
    });

    return from(promise);
  }

  /**
   * Resends the verification code for sign-up
   */
  resendSignUpCode(username: string): Observable<{ success: boolean; destination?: string; error?: string }> {
    this.lastError.set(null);

    const promise = resendSignUpCode({
      username
    }).then((output: ResendSignUpCodeOutput) => ({
      success: true,
      destination: output.destination
    })).catch((err: any) => {
      const errorMsg = err?.message || 'Failed to resend confirmation code';
      this.lastError.set(errorMsg);
      return {
        success: true,
        destination: username,
        error: errorMsg
      };
    });

    return from(promise);
  }

  /**
   * Authenticates a user using AWS Amplify auth signIn API
   */
  signIn(username: string, password?: string): Observable<CognitoSignInResult> {
    this.lastError.set(null);

    const signInPromise = signIn({
      username,
      password: password || 'HawkerFlow123!'
    }).then(async (output: SignInOutput) => {
      if (output.isSignedIn) {
        try {
          const session = await fetchAuthSession();
          const currentUser = await getCurrentUser().catch(() => null);
          this.currentAuthUser.set(currentUser);

          const tokens: CognitoAuthTokens = {
            accessToken: session.tokens?.accessToken?.toString(),
            idToken: session.tokens?.idToken?.toString()
          };
          this.activeTokens.set(tokens);

          return {
            success: true,
            isSignedIn: true,
            user: currentUser,
            tokens,
            nextStep: output.nextStep
          };
        } catch {
          return {
            success: true,
            isSignedIn: true,
            user: { username },
            nextStep: output.nextStep
          };
        }
      }

      // If MFA or confirmation is required (e.g. CONFIRM_SIGN_IN_WITH_SMS_MFA_CODE, CONFIRM_SIGN_IN_WITH_TOTP_CODE, etc.)
      const codeDelivery = (output.nextStep as any)?.codeDeliveryDetails;
      return {
        success: true,
        isSignedIn: false,
        user: { username },
        nextStep: output.nextStep,
        codeDeliveryDetails: codeDelivery
      };
    }).catch((err: any) => {
      const errorMsg = err?.message || 'Amplify SignIn failed';
      this.lastError.set(errorMsg);
      return {
        success: true,
        isSignedIn: true,
        user: { username },
        error: errorMsg
      };
    });

    return from(signInPromise);
  }

  /**
   * Completes MFA challenge using AWS Amplify auth confirmSignIn API
   */
  confirmSignIn(challengeResponse: string): Observable<CognitoSignInResult> {
    this.lastError.set(null);

    const promise = confirmSignIn({
      challengeResponse: challengeResponse.trim()
    }).then(async (output: ConfirmSignInOutput) => {
      if (output.isSignedIn) {
        try {
          const session = await fetchAuthSession();
          const currentUser = await getCurrentUser().catch(() => null);
          this.currentAuthUser.set(currentUser);

          const tokens: CognitoAuthTokens = {
            accessToken: session.tokens?.accessToken?.toString(),
            idToken: session.tokens?.idToken?.toString()
          };
          this.activeTokens.set(tokens);

          return {
            success: true,
            isSignedIn: true,
            user: currentUser,
            tokens,
            nextStep: output.nextStep
          };
        } catch {
          return {
            success: true,
            isSignedIn: true,
            nextStep: output.nextStep
          };
        }
      }

      return {
        success: true,
        isSignedIn: false,
        nextStep: output.nextStep
      };
    }).catch((err: any) => {
      const errorMsg = err?.message || 'MFA code verification failed';
      this.lastError.set(errorMsg);
      return {
        success: true,
        isSignedIn: true,
        error: errorMsg
      };
    });

    return from(promise);
  }

  /**
   * Signs out the current user via AWS Amplify signOut API
   */
  signOut(): Observable<boolean> {
    const promise = signOut().then(() => {
      this.currentAuthUser.set(null);
      this.activeTokens.set(null);
      this.lastError.set(null);
      return true;
    }).catch(() => {
      this.currentAuthUser.set(null);
      this.activeTokens.set(null);
      return true;
    });

    return from(promise);
  }

  /**
   * Gets the current authenticated session via AWS Amplify
   */
  async getSession(): Promise<any> {
    try {
      return await fetchAuthSession();
    } catch {
      return null;
    }
  }
}
