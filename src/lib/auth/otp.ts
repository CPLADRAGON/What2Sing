type EmailOtpClient = {
  auth: {
    verifyOtp: (params: {email: string; token: string; type: 'email'}) => Promise<{error: Error | {message: string} | null}>;
  };
};

export async function verifyEmailOtpCode(client: EmailOtpClient, email: string, code: string) {
  const token = code.replace(/\s+/g, '');
  const {error} = await client.auth.verifyOtp({
    email,
    token,
    type: 'email'
  });

  if (error) {
    throw error;
  }
}