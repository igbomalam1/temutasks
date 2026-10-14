export interface NovacInitiateParams {
  amount: number; // In Naira (e.g. 750)
  reference: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  redirectUrl: string;
  description?: string;
}

export interface NovacInitiateResponse {
  success: boolean;
  paymentUrl?: string;
  message?: string;
  raw?: any;
}

export interface NovacVerifyResponse {
  success: boolean;
  status: 'successful' | 'failed' | 'pending';
  amount?: number;
  email?: string;
  reference?: string;
  message?: string;
}

export async function initiateNovacPayment(params: NovacInitiateParams): Promise<NovacInitiateResponse> {
  const publicKey = process.env.NEXT_PUBLIC_NOVAC_PUBLIC_KEY;

  if (!publicKey) {
    throw new Error('NEXT_PUBLIC_NOVAC_PUBLIC_KEY is not configured');
  }

  const payload = {
    transactionReference: params.reference,
    amount: params.amount,
    currency: 'NGN',
    redirectUrl: params.redirectUrl,
    channel: 'opay',
    defaultChannel: 'opay',
    paymentChannel: 'opay',
    checkoutCustomerData: {
      email: params.email,
      firstName: params.firstName || 'Customer',
      lastName: params.lastName || 'User',
      phoneNumber: params.phoneNumber || '08000000000',
    },
    checkoutCustomizationData: {
      paymentDescription: params.description || 'TemuTasks Payment',
      checkoutModalTitle: 'TemuTasks',
      channel: 'opay',
      defaultChannel: 'opay',
      paymentChannel: 'opay',
    },
  };

  try {
    const res = await fetch('https://api.novacpayment.com/api/v1/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicKey}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!data.status) {
      return {
        success: false,
        message: data.message || 'Failed to initiate payment with Novac',
        raw: data,
      };
    }

    return {
      success: true,
      paymentUrl: data.data?.paymentRedirectUrl,
      raw: data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Connection error to Novac API',
    };
  }
}

export async function verifyNovacPayment(reference: string): Promise<NovacVerifyResponse> {
  const secretKey = process.env.NOVAC_SECRET_KEY;

  if (!secretKey) {
    throw new Error('NOVAC_SECRET_KEY is not configured');
  }

  try {
    const url = `https://api.novacpayment.com/api/v1/checkout/${encodeURIComponent(reference)}/verify`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
        'Cache-Control': 'no-cache',
      },
    });

    const data = await res.json();

    if (!data.status) {
      return {
        success: false,
        status: 'failed',
        message: data.message || 'Novac verification returned failure',
      };
    }

    const txData = data.data;
    if (txData && txData.status === 'successful') {
      return {
        success: true,
        status: 'successful',
        amount: txData.amount,
        email: txData.customer?.email,
        reference: txData.reference || reference,
        message: 'Payment verified successfully',
      };
    } else {
      return {
        success: false,
        status: txData?.status === 'pending' ? 'pending' : 'failed',
        message: `Transaction status: ${txData?.status || 'Unknown'}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      status: 'failed',
      message: err.message || 'Connection error verifying Novac payment',
    };
  }
}
