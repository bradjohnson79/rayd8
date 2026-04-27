import { memo, useCallback, useMemo, useState } from 'react'
import { Section } from './components/Section'
import { TestimonialVideoPlayer } from './components/TestimonialVideoPlayer'
import { WrittenTestimonialSlider } from './components/WrittenTestimonialSlider'

interface TestimonialsSectionProps {
  reducedEffects?: boolean
}

const testimonialVideos = [
  {
    id: 'testimonial-1',
    thumbnailUrl: 'https://img.youtube.com/vi/WGce4s9Sqyc/hqdefault.jpg',
    title: 'Testimonial 1',
    youtubeId: 'WGce4s9Sqyc',
  },
  {
    id: 'testimonial-2',
    thumbnailUrl: 'https://img.youtube.com/vi/bNIk9PGuvqc/hqdefault.jpg',
    title: 'Testimonial 2',
    youtubeId: 'bNIk9PGuvqc',
  },
  {
    id: 'testimonial-3',
    thumbnailUrl: 'https://img.youtube.com/vi/APrDynSKC9g/hqdefault.jpg',
    title: 'Testimonial 3',
    youtubeId: 'APrDynSKC9g',
  },
  {
    id: 'testimonial-4',
    thumbnailUrl: 'https://img.youtube.com/vi/DSWhJUq81BI/hqdefault.jpg',
    title: 'Testimonial 4',
    youtubeId: 'DSWhJUq81BI',
  },
  {
    id: 'testimonial-5',
    thumbnailUrl: 'https://img.youtube.com/vi/lltP0TkvG_U/hqdefault.jpg',
    title: 'Testimonial 5',
    youtubeId: 'lltP0TkvG_U',
  },
  {
    id: 'testimonial-6',
    thumbnailUrl: 'https://img.youtube.com/vi/YpDI2k4sIbg/hqdefault.jpg',
    title: 'Testimonial 6',
    youtubeId: 'YpDI2k4sIbg',
  },
  {
    id: 'testimonial-7',
    thumbnailUrl: 'https://img.youtube.com/vi/TlfZoqC5JUg/hqdefault.jpg',
    title: 'Testimonial 7',
    youtubeId: 'TlfZoqC5JUg',
  },
  {
    id: 'testimonial-8',
    thumbnailUrl: 'https://img.youtube.com/vi/YTsOa5NxkQc/hqdefault.jpg',
    title: 'Testimonial 8',
    youtubeId: 'YTsOa5NxkQc',
  },
] as const

const writtenTestimonials = [
  {
    context: 'Member story',
    name: 'Erika Troy',
    quote:
      "I can feel the powerful radiation, my hands started to pulsate and felt this beautiful wave of energy pulsating through me. I used the power of my mind to direct it to my knee joints and to my eyes and pineal gland. It feels like my entire energy field is strengthened and a cocoon of light is surrounding me. I am absolutely amazed, and this is the free version!",
  },
  {
    context: 'Member story',
    name: 'Arlene Samano',
    quote:
      "It helped me sleep better. It helped with my headache as well. It helps create a peaceful and positive environment. It also works great for meditation and yoga practice.",
  },
  {
    context: 'Member story',
    name: 'Shazhad Rashid',
    quote:
      "After a total of about 4 to 5 hours exposure to the iMac screen with RAYD8® playing repeatedly, I noticed at the end of today, the skin on my hands were no longer dry and felt silky smooth, and my fingernails were smooth. Most importantly, the inflammatory pain in my left knee decreased for the first time since it started 2 weeks ago. Wow!",
  },
  {
    context: 'Member story',
    name: 'Chyrese Soubasis',
    quote:
      "My dog Pip has been sick from chemical toxicity, causing some nerve damage. She was having trouble not only with overall healing but also had difficulty walking. After I installed the app I cranked up the brightness and put my phone a few inches from Pip while she rested. After the first couple hours she got up and walked around, seemed perky and hungry. I continued doing this for several hours a day for the last few days consecutive. Today Pip is feeling exponentially better with this treatment. Additionally, it has made her more compatible with her supplements. They seem to be helping faster than they were the previous 2 months. She is walking much better, and I know she enjoys the RAYD8® music. I’m so happy, relieved, and grateful. This has been such an inspiring experience.",
  },
  {
    context: 'Member story',
    name: 'Alice Pottinger',
    quote:
      "I felt the vibration going into my body. I have been sick with an upper cervical spine disorder which causes light-headedness every single day for the past 7 yrs. I tried RAYD8® for about 15 minutes and felt energized. I can't explain it.",
  },
  {
    context: 'Member story',
    name: 'John Estabrooks',
    quote:
      "I purchased a RAYD8® subscription last week. In that time, just playing it throughout the night, I am waking up more refreshed and energized, with a nice calmness during the day. Very satisfied with my purchase. It broke through a depression phase I was going through. I look forward to new discoveries of how this affects me. The science is very interesting.",
  },
  {
    context: 'Member story',
    name: 'Carolann Smith',
    quote:
      "I have had a pinched nerve in my neck for a while and the pain has diminished a great deal. I also have had pain in my gums in two different areas of my mouth and that pain is almost completely gone. I have noticed an increase in my vitality, plus I feel that I’m doing a lot better on a mental level.",
  },
  {
    context: 'Member story',
    name: 'George Cunningham',
    quote:
      "Since I have been using RAYD8®, it has been helping me to detox my organs and body. It has helped reduce the hip pain I have had for years, more than 50% less pain. I have been sleeping better, my sleep patterns have changed for the better. I used to frequently wake 3 or 4 times a night to urinate. I am now able to sleep almost all night without waking up. Overall, my general health is improving and I am feeling stronger and have more energy during the day.",
  },
  {
    context: 'Member story',
    name: 'Peter Fordham',
    quote:
      "I play it on my phone at work all day for 10 hours. There seems to be a more jovial atmosphere around the area I’m working in. One colleague said he felt more energised in the afternoon. Usually, he has an afternoon slump. He downloaded the free version and uses it at home with his breath work. I have a friend who wasn't sleeping very well. I told her to download the free version. She is now sleeping well. My mother finds the free version very relaxing.",
  },
] as const

export const TestimonialsSection = memo(function TestimonialsSection({
  reducedEffects = false,
}: TestimonialsSectionProps) {
  const [activeVideoIndex, setActiveVideoIndex] = useState(0)
  const [hasUserStartedPlayback, setHasUserStartedPlayback] = useState(false)
  const [shouldAutoplayActiveVideo, setShouldAutoplayActiveVideo] = useState(false)

  const activeVideo = useMemo(
    () => testimonialVideos[activeVideoIndex] ?? testimonialVideos[0],
    [activeVideoIndex],
  )

  const handlePlaybackStarted = useCallback(() => {
    setHasUserStartedPlayback(true)
    setShouldAutoplayActiveVideo(false)
  }, [])

  const handleVideoEnded = useCallback(() => {
    if (!hasUserStartedPlayback) {
      return
    }

    const isLastVideo = activeVideoIndex === testimonialVideos.length - 1
    setActiveVideoIndex(isLastVideo ? 0 : activeVideoIndex + 1)
    setShouldAutoplayActiveVideo(!isLastVideo)
  }, [activeVideoIndex, hasUserStartedPlayback])

  const handleSelectVideo = useCallback((index: number) => {
    setActiveVideoIndex(index)
    setShouldAutoplayActiveVideo(false)
  }, [])

  return (
    <Section
      childrenClassName="w-full"
      description="Testimonials filmed during a live RAYD8® home demonstration."
      eyebrow="Testimonials"
      id="testimonials"
      reducedEffects={reducedEffects}
      title="Real people who experienced RAYD8® living technology for the first time."
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)] xl:gap-8">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:rounded-[2.25rem] sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.34em] text-white/56">Video testimonials</p>
            </div>
            <p className="shrink-0 rounded-full border border-white/10 bg-black/15 px-3 py-1 text-xs text-white/62">
              {activeVideoIndex + 1} / {testimonialVideos.length}
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="w-full max-w-[20rem] sm:max-w-[22rem] lg:max-w-[24rem] xl:max-w-[25rem]">
              <div className="aspect-[9/16] overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#05080c] shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
                <TestimonialVideoPlayer
                  key={`${activeVideo.youtubeId}-${shouldAutoplayActiveVideo ? 'autoplay' : 'manual'}`}
                  onPlaybackStarted={handlePlaybackStarted}
                  onVideoEnded={handleVideoEnded}
                  shouldAutoplay={shouldAutoplayActiveVideo}
                  video={activeVideo}
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
            <div>
              <p className="text-sm font-medium text-white">{activeVideo.title}</p>
              <p className="mt-1 text-xs leading-6 text-slate-400">
                {hasUserStartedPlayback
                  ? 'Auto-advance is enabled after you manually start playback.'
                  : 'No autoplay on load. Start any testimonial to enable auto-advance.'}
              </p>
            </div>
          </div>

          <div className="-mx-1 mt-6 flex gap-3 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {testimonialVideos.map((video, index) => {
              const isActive = index === activeVideoIndex
              return (
                <button
                  aria-label={`Select ${video.title}`}
                  aria-pressed={isActive}
                  className={[
                    'min-w-[8.8rem] overflow-hidden rounded-[1.2rem] border bg-black/20 text-left transition duration-200 md:min-w-0',
                    isActive
                      ? 'border-emerald-200/55 shadow-[0_0_0_1px_rgba(167,243,208,0.18)]'
                      : 'border-white/10 hover:border-white/18',
                  ].join(' ')}
                  key={video.id}
                  onClick={() => handleSelectVideo(index)}
                  type="button"
                >
                  <img
                    alt={video.title}
                    className="aspect-video w-full object-cover"
                    decoding="async"
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    src={video.thumbnailUrl}
                  />
                  <div className="px-3 py-2.5">
                    <p className="text-xs font-medium uppercase tracking-[0.26em] text-white/76">
                      {video.title}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <WrittenTestimonialSlider
          reducedEffects={reducedEffects}
          testimonials={writtenTestimonials}
        />
      </div>
    </Section>
  )
})
