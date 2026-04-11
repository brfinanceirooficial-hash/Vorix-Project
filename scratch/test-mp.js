import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import dotenv from 'dotenv';
dotenv.config();

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN || '' 
});

console.log('Testing Mercado Pago Config...');
console.log('Token starts with:', process.env.MP_ACCESS_TOKEN?.substring(0, 10));

async function test() {
  try {
    const preApproval = new PreApproval(client);
    console.log('PreApproval object created');
    
    // Attempt a dummy create to check auth
    // (We use a very low amount or just check if the class exists)
    console.log('Class exists:', !!PreApproval);
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
