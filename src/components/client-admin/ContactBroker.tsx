import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft,
  Mic,
  Send,
  Loader2,
  CheckCircle,
  MessageSquare,
  Play,
  Pause,
  AlertCircle,
  FileText,
  Clock,
  CheckCheck,
  Download,
  X,
} from 'lucide-react';

interface ClientRequest {
  id: string;
  client_user_id: string;
  brokerage_id: string | null;
  request_type: string;
  subject: string;
  message: string | null;
  voice_path: string | null;
  transcript: string | null;
  meeting_requested: boolean;
  meeting_preferred_times: string | null;
  status: string;
  created_at: string;
}

interface ContactBrokerProps {
  onBack: () => void;
}

export default function ContactBroker({ onBack }: ContactBrokerProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // Form state
  const [requestType, setRequestType] = useState('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [meetingRequested, setMeetingRequested] = useState(false);
  const [meetingPreferredTimes, setMeetingPreferredTimes] = useState('');
  const [brokerageId, setBrokerageId] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (user) {
      fetchBrokerageId();
      fetchRequests();
    }
  }, [user]);

  const fetchBrokerageId = async () => {
    if (!user) return;

    try {
      const { data: authRes } = await supabase.auth.getUser();
      const currentUser = authRes.user;
      if (!currentUser) throw new Error('Not authenticated');

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('user_id, brokerage_id')
        .eq('user_id', currentUser.id)
        .single();

      if (profileErr) {
        console.error('Profile lookup error:', profileErr);
        return;
      }

      if (profile?.brokerage_id) {
        setBrokerageId(profile.brokerage_id);
      }
    } catch (err) {
      console.error('Error fetching brokerage ID:', err);
    }
  };

  const fetchRequests = async () => {
    if (!user) return;

    try {
      setLoadingRequests(true);
      const { data, error: fetchError } = await supabase
        .from('client_requests')
        .select('*')
        .eq('client_user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

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
    } catch (err) {
      console.error('Recording error:', err);
      setError('Could not access microphone. Please check permissions.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playAudio = () => {
    if (!audioBlob) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      const audioUrl = URL.createObjectURL(audioBlob);
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
      }
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const transcribeAudio = async (voicePath: string): Promise<string> => {
    try {
      setTranscribing(true);

      // Get signed URL for the audio file
      const { data: signedData, error: signedError } = await supabase.storage
        .from('client-voicenotes')
        .createSignedUrl(voicePath, 300);

      if (signedError) throw signedError;

      // Call transcription edge function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ audioUrl: signedData.signedUrl }),
        }
      );

      if (!response.ok) throw new Error('Transcription failed');

      const result = await response.json();
      return result.transcript || '[Transcription unavailable]';
    } catch (err) {
      console.error('Transcription error:', err);
      return '[Transcription unavailable]';
    } finally {
      setTranscribing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !subject.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      let voicePath: string | null = null;

      // Upload voice note if present
      if (audioBlob) {
        const timestamp = Date.now();
        const fileName = `${timestamp}-voicenote.webm`;
        voicePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('client-voicenotes')
          .upload(voicePath, audioBlob);

        if (uploadError) throw uploadError;
      }

      // Create request
      const { data: requestData, error: insertError } = await supabase
        .from('client_requests')
        .insert({
          client_user_id: user.id,
          brokerage_id: brokerageId,
          request_type: requestType,
          subject: subject.trim(),
          message: message.trim() || null,
          voice_path: voicePath,
          meeting_requested: meetingRequested,
          meeting_preferred_times: meetingRequested ? meetingPreferredTimes.trim() || null : null,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Transcribe voice note if present
      if (voicePath && requestData) {
        const transcriptText = await transcribeAudio(voicePath);

        // Update request with transcript
        await supabase
          .from('client_requests')
          .update({ transcript: transcriptText })
          .eq('id', requestData.id);
      }

      // Reset form
      setRequestType('general');
      setSubject('');
      setMessage('');
      setMeetingRequested(false);
      setMeetingPreferredTimes('');
      setAudioBlob(null);
      setTranscript('');
      setSuccess('Request sent successfully to your broker');

      // Refresh requests
      await fetchRequests();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error submitting request:', err);
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadVoice = async (voicePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('client-voicenotes')
        .createSignedUrl(voicePath, 60);

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Error downloading voice note:', err);
      setError('Failed to download voice note');
      setTimeout(() => setError(null), 3000);
    }
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      policy_change: 'Policy Change',
      meeting_request: 'Meeting Request',
      general: 'General Inquiry',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: any; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
      in_progress: { color: 'bg-blue-100 text-blue-800', icon: Loader2, label: 'In Progress' },
      resolved: { color: 'bg-green-100 text-green-800', icon: CheckCheck, label: 'Resolved' },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${badge.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {badge.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="max-w-5xl mx-auto p-4 py-8">
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
              <p className="text-gray-600 mt-1">
                Send a request or message to your insurance broker
              </p>
            </div>
          </div>
        </div>

        {/* Create Request Form */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <MessageSquare className="w-6 h-6 mr-2 text-blue-700" />
            New Request
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Request Type *
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="general">General Inquiry</option>
                  <option value="policy_change">Policy Change</option>
                  <option value="meeting_request">Meeting Request</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Update my contact details"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Provide additional details about your request..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
              />
            </div>

            {/* Voice Note Recorder */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
                <Mic className="w-5 h-5 mr-2" />
                Record a Voice Note (Optional)
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                Click the microphone to record a voice message for your broker
              </p>

              {!audioBlob ? (
                <div className="text-center py-4">
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-3 transition ${
                      isRecording
                        ? 'bg-red-500 animate-pulse'
                        : 'bg-blue-700 hover:bg-blue-800'
                    }`}
                  >
                    <Mic className="w-10 h-10 text-white" />
                  </button>
                  <p className="text-sm text-gray-600">
                    {isRecording ? 'Recording... Click to stop' : 'Click to start recording'}
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-white rounded-lg p-4">
                  <div className="flex items-center">
                    <CheckCircle className="w-8 h-8 text-green-500 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Voice note recorded</p>
                      <p className="text-xs text-gray-500">Ready to send</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={playAudio}
                      className="p-2 text-blue-700 hover:bg-blue-100 rounded-lg transition"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAudioBlob(null)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Remove"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}

              {transcribing && (
                <div className="mt-3 flex items-center text-blue-700 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Transcribing voice note...
                </div>
              )}
            </div>

            {/* Meeting Request Toggle */}
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={meetingRequested}
                  onChange={(e) => setMeetingRequested(e.target.checked)}
                  className="w-5 h-5 text-blue-700 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm font-medium text-gray-900">
                  I would like to schedule a meeting
                </span>
              </label>

              {meetingRequested && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Meeting Times
                  </label>
                  <textarea
                    value={meetingPreferredTimes}
                    onChange={(e) => setMeetingPreferredTimes(e.target.value)}
                    placeholder="e.g., Monday 10-12 AM or Wednesday after 3 PM"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={2}
                  />
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center text-red-600 bg-red-50 p-4 rounded-lg">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center text-green-600 bg-green-50 p-4 rounded-lg">
                <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-sm font-medium">{success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !subject.trim()}
              className="w-full flex items-center justify-center px-6 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  Send Request
                </>
              )}
            </button>
          </form>
        </div>

        {/* Request History */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <FileText className="w-6 h-6 mr-2 text-blue-700" />
            Your Requests ({requests.length})
          </h2>

          {loadingRequests ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-700 animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No requests yet</h3>
              <p className="text-gray-600">
                Submit your first request using the form above
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{request.subject}</h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {getRequestTypeLabel(request.request_type)} • {formatDate(request.created_at)}
                      </p>
                    </div>
                  </div>

                  {request.message && (
                    <p className="text-sm text-gray-700 mb-3 bg-gray-50 p-3 rounded">
                      {request.message}
                    </p>
                  )}

                  {request.meeting_requested && request.meeting_preferred_times && (
                    <div className="text-sm text-blue-700 bg-blue-50 p-3 rounded mb-3">
                      <strong>Meeting requested:</strong> {request.meeting_preferred_times}
                    </div>
                  )}

                  {request.voice_path && (
                    <div className="flex items-center space-x-4 mb-3">
                      <button
                        onClick={() => handleDownloadVoice(request.voice_path!)}
                        className="flex items-center text-sm text-blue-700 hover:text-blue-900"
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Voice Note
                      </button>
                    </div>
                  )}

                  {request.transcript && (
                    <div className="text-sm text-gray-700 bg-blue-50 border border-blue-200 p-3 rounded">
                      <strong className="text-blue-900">Transcript:</strong>
                      <p className="mt-1">{request.transcript}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
