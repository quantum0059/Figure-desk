import Head from 'next/head';
import Studio from '../lib/Studio';
import saved from '../results.json';
export default function Home(){return <><Head><title>Figure Desk · Science diagram review</title><meta name="description" content="Generate, validate and review animated GCSE science diagrams."/></Head><Studio saved={saved}/></>;}
