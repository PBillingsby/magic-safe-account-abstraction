import { useMagic } from '../MagicProvider';
import showToast from '@/utils/showToast';
import Spinner from '../../ui/Spinner';
import { RPCError, RPCErrorCode } from 'magic-sdk';
import { LoginProps } from '@/utils/types';
import { saveUserInfo } from '@/utils/common';
import Card from '../../ui/Card';
import CardHeader from '../../ui/CardHeader';
import { useState } from 'react';
import FormInput from '@/components/ui/FormInput';

import Safe, { PredictedSafeProps, SafeAccountConfig, SafeFactory } from '@safe-global/protocol-kit';

const EmailOTP = ({ token, setToken }: LoginProps) => {
  const { magic } = useMagic();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [isLoginInProgress, setLoginInProgress] = useState(false);

  const handleLogin = async () => {
    if (!email.match(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/)) {
      setEmailError(true);

    } else {
      try {
        setLoginInProgress(true);
        setEmailError(false);
        const token = await magic?.auth.loginWithEmailOTP({ email });

        const metadata = await magic?.user.getMetadata();

        if (!token || !metadata?.publicAddress) {
          throw new Error('Magic login failed');
        }

        setToken(token);
        saveUserInfo(token, 'EMAIL', metadata?.publicAddress);
        setEmail('');

        const magicProvider = await magic?.wallet.getProvider();

        // Initialize safe based off Magic user
        const safeFactory = await SafeFactory.init({
          provider: magicProvider,
          signer: metadata?.publicAddress
        })

        const safeAccountConfig: SafeAccountConfig = {
          owners: [metadata?.publicAddress], // Add more to create x of y multisig
          threshold: 1,
        }

        // Checks if Safe is deployed and pulls address from it
        const predictedSafeAddress = await safeFactory.predictSafeAddress(safeAccountConfig);

        // Takes the safeAccountConfig and predicts the Safe
        const predictedSafe: PredictedSafeProps = {
          safeAccountConfig,
          safeDeploymentConfig: {}
        }

        // This will initialize a Safe if one is deployed
        let protocolKit = await Safe.init({
          provider: magicProvider,
          signer: metadata?.publicAddress,
          predictedSafe
        })

        // If no Safe deployed from that Magic user, deploy one
        if (!predictedSafeAddress) {
          const deploySafe = await safeFactory.deploySafe({
            safeAccountConfig
          })

          protocolKit = await Safe.init({
            provider: magicProvider,
            safeAddress: await deploySafe.getAddress()
          });
        }

        // Safe address and balance
        const safeAddress = await protocolKit.getAddress();
        const balance = await protocolKit.getBalance();


        debugger
      } catch (e) {
        console.log('login error: ' + JSON.stringify(e));
        if (e instanceof RPCError) {
          switch (e.code) {
            case RPCErrorCode.MagicLinkFailedVerification:
            case RPCErrorCode.MagicLinkExpired:
            case RPCErrorCode.MagicLinkRateLimited:
            case RPCErrorCode.UserAlreadyLoggedIn:
              showToast({ message: e.message, type: 'error' });
              break;
            default:
              showToast({
                message: 'Something went wrong. Please try again',
                type: 'error',
              });
          }
        }
      } finally {
        setLoginInProgress(false);
      }
    }
  };

  return (
    <Card>
      <CardHeader id="login">Email OTP Login</CardHeader>
      <div className="login-method-grid-item-container">
        <FormInput
          onChange={(e) => {
            if (emailError) setEmailError(false);
            setEmail(e.target.value);
          }}
          placeholder={token.length > 0 ? 'Already logged in' : 'Email'}
          value={email}
        />
        {emailError && <span className="error">Enter a valid email</span>}
        <button
          className="login-button"
          disabled={isLoginInProgress || (token.length > 0 ? false : email.length == 0)}
          onClick={() => handleLogin()}
        >
          {isLoginInProgress ? <Spinner /> : 'Log in / Sign up'}
        </button>
      </div>
    </Card>
  );
};

export default EmailOTP;
