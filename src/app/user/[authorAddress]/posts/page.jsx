"use client";

import { useQuery } from '@tanstack/react-query';
import Post from '@/components/Post/Structure/Index';
import { request, gql } from 'graphql-request';
import PageTitle from '@/components/Title';
import Error from '@/components/Error';
import React from 'react';
import { useParams } from 'next/navigation';

const MyPosts = () => {
  const PERSONAL_POSTS = gql`
    query GetPosts($authorAddress: String!) {
      post(where: { author_address: { _eq: $authorAddress } }) {
        text
        id
        subspace_section {
          name
          id
        }
        post_urls {
          url
        }
      }
    }
  `;

  const { authorAddress } = useParams();

  const { data: personalPosts, isLoading, isError } = useQuery({
    queryKey: ['personalPost', authorAddress],
    queryFn: async () => {
      if (!authorAddress) return [];
      const data = await request('http://localhost:8080/v1/graphql/', PERSONAL_POSTS, { authorAddress });
      return data.post;
    },
    enabled: !!authorAddress,
  });

  if (isLoading) return <div><p>Loading...</p></div>;
  if (isError) return <Error message="Error fetching personal post data." />;
  if (personalPosts?.length === 0) return <Error message="No personal posts found." />;

  return (
    <div className="container p-0 p-lg-1">
      <PageTitle title="My posts" />
      <ul className="list-unstyled">
        {personalPosts?.map((post, index) => (
          <Post
            post={post}
            post_page={false}
            index={index}
            key={index} />
        ))}
      </ul>
    </div>
  );
};

export default MyPosts;