import type { Experience } from '../app/types'
import type { SessionVideoMode } from '../config/rayd8Expansion'

export type PlaybackQuality = '720p' | '1080p'

export type Rayd8AssetMap = Record<
  Experience,
  Record<PlaybackQuality, Record<SessionVideoMode, string>>
>

export const RAYD8_ASSETS: Rayd8AssetMap = {
  expansion: {
    '720p': {
      standard: '4cjen3yVzhM9RAj3WCw9AjrvYLNwv00hEFn029CgCKZNw',
      slow: '02BoM839qKRVjsRAzG3QmKk3mtMfT8irWVVuKGSMul6E',
      fast: 'qUxzgx60002OuXq00wHNstAj3i900X00lBVyIivzdd100gkL4',
      superSlow: 'xmofOgizsbzJ02lVZQGfgJ02MvkbCVh7PP9i4i6LTY4nk',
      superFast: 'QLHA65ECE5cjwMa7o7sDg51ofiPEZ8rrXEUrKwl1F8U',
    },
    '1080p': {
      standard: 'Z00QqfpH4qKEuL1lm00XxdBo9OeWtNPjdndRXuzErRJmE',
      slow: '901bYptxgxTxDn7IPlf0253602FtmyB877eUyc3vDTCfQs',
      fast: 'FQEcEsSRHmq01tqX9KnIaT1VVzOKvk02lGXIQzWV6yRMM',
      superSlow: 'Mo01HBPQ6sGdYFdZE102914iNxG2aCzQho6oEQ1UbpclU',
      superFast: '029qSjS5mcpZh41IysgP01C8CtbutCYPKUDuVz8Vv600Ns',
    },
  },
  premium: {
    '720p': {
      standard: '1FPP5E00uS51TwH5e016PcYgFTN0002hE02v00T5uLmy1fQSI',
      slow: 'sy402f4In5hCq9lgR2u02WovvLJHKspUqIQoaIctUBT01Q',
      fast: 'x3VPHPv02QQLV1mBg6U2m4SQ00oY007019QBTk9xzQ4kUwM',
      superSlow: 'r8WS8Mib4QM9uAOQleDMTTkiFMeJYXmpYYh84Z4RnBE',
      superFast: '02sc46o8xl5DcsdmPyI6ukuFl2JSdKfBOnDRV6x71F7c',
    },
    '1080p': {
      standard: 'uL01005XHjYDGNMx1ETgUtPJiADwDDI1Pslsg2snXPxq8',
      slow: 'zEFqsegOJvXHWHYo0102863nsomwxMO7JLXuyh9G4apNY',
      fast: '00fNNbcVHgAm5ix9khdTeThzdQICFuAwaP6wDGZvUJlE',
      superSlow: 'D7M3C5gwDNuSb4s814nv3pNzVZxhCmixnOMAbEGiSbg',
      superFast: 'OObm6quGEVLsuExl01REofbJWUYZFPXZMIAImGQuSr8o',
    },
  },
  regen: {
    '720p': {
      standard: 'jIWn7Xv4D01VrZVkPhu00kvhZ8Aodg5ZDzIQbaSEDpu6o',
      slow: 'lcSFRWC9ggMxqBxBuV2bEdLGcf79zlEwR9kpdL002f00E',
      fast: 'fjpKmWbcGem00d00s3lkIWbiFRNfsXY578fYxKktbQjso',
      superSlow: '102CCM01JJ3dlAeCzDw00ibDBLPkcRtZLmN6oQ1eCTPd8E',
      superFast: '4rDqy4vzLes8022NifAM7hRr3XvBSsDAG9Uu8SODbNLw',
    },
    '1080p': {
      standard: 'TkzOgf8ry1s01jP5dl9baQbzq7W01n1wJxXOP3IgYgDCw',
      slow: 'Q02XQ1pFWgJhD7BKojThWQo2uUKeQDuTjv012EJ7OkFL4',
      fast: 'Tb8Ov6T02Lb2YUiSSxXFjJCswHz00kdcx29JK7eN02lQVc',
      superSlow: 'g1CwuzPb01mVG2wuDRvF01wWjoEL3FeqHuP2mX005j9DXE',
      superFast: '7t01HcXER8akci02JIj2qK2I00NZyV500Ip2sG7tfO4P7RI',
    },
  },
}
