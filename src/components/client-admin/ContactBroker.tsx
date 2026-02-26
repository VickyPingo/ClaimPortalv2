import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Mic, Calendar, Send, Loader2, CheckCircle, Phone, Mail, MessageSquare } from 'lucide-react';

interface ContactBrokerProps {
  onBack: () => void;
}

export default function ContactBroker({ onBack }: ContactBrokerProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'voice' | 'meeting'>('voice');

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [sendingVoice, setSendingVoice] = useState(false);
  const [voiceSent, setVoiceSent] = useState(false);

  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingReason, setMeetingReason] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [sendingMeeting, setSendingMeeting] = useState(false);
  const [meetingSent, setMeetingSent] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      alert('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSendVoiceMessage = async () => {
    if (!user || (!audioBlob && !voiceMessage)) return;

    try {
      setSendingVoice(true);
      setVoiceSent(false);

      let voiceNoteUrl = null;

      if (audioBlob) {
        const timestamp = Date.now();
        const audioFile = new File([audioBlob], 'voice_message.webm', {
          type: 'audio/webm',
        });

        const filePath = `${user.id}/voice_messages/${timestamp}_voice.webm`;
        const { error: uploadError } = await supabase.storage
          .from('claim-documents')
          .upload(filePath, audioFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('claim-documents')
          .getPublicUrl(filePath);

        voiceNoteUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from('broker_messages').insert({
        user_id: user.id,
        message_type: 'voice_note',
        text_message: voiceMessage || null,
        voice_url: voiceNoteUrl,
        status: 'new',
      });

      if (error) throw error;

      setVoiceSent(true);
      setVoiceMessage('');
      setAudioBlob(null);
      setTimeout(() => setVoiceSent(false), 3000);
    } catch (err: any) {
      console.error('Error sending voice message:', err);
      alert('Failed to send message: ' + err.message);
    } finally {
      setSendingVoice(false);
    }
  };

  const handleRequestMeeting = async () => {
    if (!user || !meetingDate || !meetingTime || !meetingReason) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSendingMeeting(true);
      setMeetingSent(false);

      const meetingDateTime = `${meetingDate}T${meetingTime}`;

      const { error } = await supabase.from('meeting_requests').insert({
        user_id: user.id,
        requested_date: meetingDateTime,
        reason: meetingReason,
        notes: meetingNotes || null,
        status: 'pending',
      });

      if (error) throw error;

      setMeetingSent(true);
      setMeetingDate('');
      setMeetingTime('');
      setMeetingReason('');
      setMeetingNotes('');
      setTimeout(() => setMeetingSent(false), 3000);
    } catch (err: any) {
      console.error('Error requesting meeting:', err);
      alert('Failed to request meeting: ' + err.message);
    } finally {
      setSendingMeeting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-4xl mx-auto p-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Contact Broker</h1>
              <p className="text-gray-600 mt-1">Send a voice message or request a meeting</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex-1 py-4 px-6 font-semibold transition ${
                activeTab === 'voice'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MessageSquare className="w-5 h-5 inline mr-2" />
              Voice Message
            </button>
            <button
              onClick={() => setActiveTab('meeting')}
              className={`flex-1 py-4 px-6 font-semibold transition ${
                activeTab === 'meeting'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Calendar className="w-5 h-5 inline mr-2" />
              Request Meeting
            </button>
          </div>

          <div className="p-8">
            {activeTab === 'voice' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Phone className="w-5 h-5 mr-2" />
                    Record a Voice Note
                  </h3>
                  <p className="text-sm text-blue-700 mb-4">
                    Click the microphone to record a message for your broker
                  </p>

                  <div className="text-center py-6">
                    {!audioBlob ? (
                      <div>
                        <button
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 transition ${
                            isRecording
                              ? 'bg-red-500 animate-pulse'
                              : 'bg-blue-700 hover:bg-blue-800'
                          }`}
                        >
                          <Mic className="w-12 h-12 text-white" />
                        </button>
                        <p className="text-sm text-gray-600">
                          {isRecording ? 'Recording... Tap to stop' : 'Tap to start recording'}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 mb-4">Voice note recorded</p>
                        <button
                          onClick={() => setAudioBlob(null)}
                          className="text-blue-700 text-sm hover:underline"
                        >
                          Record again
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Text Message (Optional)
                  </label>
                  <textarea
                    value={voiceMessage}
                    onChange={(e) => setVoiceMessage(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={4}
                    placeholder="Add any additional context or information..."
                  />
                </div>

                {voiceSent && (
                  <div className="flex items-center text-green-600 bg-green-50 p-4 rounded-lg">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <span className="text-sm font-medium">Message sent successfully</span>
                  </div>
                )}

                <button
                  onClick={handleSendVoiceMessage}
                  disabled={sendingVoice || (!audioBlob && !voiceMessage)}
                  className="w-full flex items-center justify-center px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-semibold transition"
                >
                  {sendingVoice ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Send Message
                    </>
                  )}
                </button>
              </div>
            )}

            {activeTab === 'meeting' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Schedule a Meeting
                  </h3>
                  <p className="text-sm text-blue-700">
                    Request a meeting with your broker to discuss your policy or claims
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Date *
                    </label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Time *
                    </label>
                    <input
                      type="time"
                      value={meetingTime}
                      onChange={(e) => setMeetingTime(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Meeting *
                  </label>
                  <select
                    value={meetingReason}
                    onChange={(e) => setMeetingReason(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a reason</option>
                    <option value="claim_discussion">Claim Discussion</option>
                    <option value="policy_review">Policy Review</option>
                    <option value="coverage_inquiry">Coverage Inquiry</option>
                    <option value="payment_issue">Payment Issue</option>
                    <option value="general_inquiry">General Inquiry</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={4}
                    placeholder="Any additional information you'd like to discuss..."
                  />
                </div>

                {meetingSent && (
                  <div className="flex items-center text-green-600 bg-green-50 p-4 rounded-lg">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <span className="text-sm font-medium">Meeting request sent successfully</span>
                  </div>
                )}

                <button
                  onClick={handleRequestMeeting}
                  disabled={sendingMeeting || !meetingDate || !meetingTime || !meetingReason}
                  className="w-full flex items-center justify-center px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 font-semibold transition"
                >
                  {sendingMeeting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-5 h-5 mr-2" />
                      Request Meeting
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
