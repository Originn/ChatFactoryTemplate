import { getSession } from '@auth0/nextjs-auth0';
import Image from 'next/image';
'use server'
export default function ProfileServer() {
  const { user } = getSession();

  return (
      user && (
          <div>
            <Image src={user.picture} alt={user.name} />
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
      )
  );
}