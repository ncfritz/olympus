import ExpoModulesCore
import Foundation
import Security

/**
 * Presenting a client certificate from the app's own requests.
 *
 * React Native's networking cannot do this: the identity has to reach a
 * `URLSession` delegate, and only native code holds one. That is the whole
 * reason this module exists, and the reason the iOS app will need it too
 * (ADR 0018, and the border in ADR 0023).
 *
 * The identity is held in memory for the life of the process rather than added
 * to the Keychain. A tester that installed identities permanently would leave
 * them behind after a reinstall, and choosing when to persist one is the real
 * app's decision, not this one's.
 */

/**
 * Anything the caller can act on.
 *
 * An Expo `Exception` rather than a plain Swift error: a plain one reaches
 * JavaScript wrapped in `UnexpectedException`, which puts "unexpected" in front
 * of every message this module means to give -- including the ones that are the
 * answer, like a listener refusing the certificate.
 */
final class ClientIdentityFailure: GenericException<String> {
  override public var reason: String { param }
}

struct RequestOptions: Record {
  @Field var url: String = ""
  @Field var method: String = "GET"
  @Field var headers: [String: String] = [:]
  @Field var body: String?
  /** Seconds. A handshake that is going to fail should fail promptly. */
  @Field var timeout: Double = 30
}

/**
 * Answers both halves of a mutual-TLS handshake.
 *
 * The server side is here because a phone does not trust a private CA, and
 * installing a throwaway root on a test device is worse than holding its
 * certificate: with anchors set, the evaluation is exactly the system's, only
 * against the authorities we name.
 */
final class MutualTlsDelegate: NSObject, URLSessionDelegate {
  private let identity: SecIdentity?
  private let chain: [SecCertificate]
  private let anchors: [SecCertificate]

  init(identity: SecIdentity?, chain: [SecCertificate], anchors: [SecCertificate]) {
    self.identity = identity
    self.chain = chain
    self.anchors = anchors
  }

  func urlSession(
    _ session: URLSession,
    didReceive challenge: URLAuthenticationChallenge,
    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
  ) {
    switch challenge.protectionSpace.authenticationMethod {
    case NSURLAuthenticationMethodClientCertificate:
      guard let identity else {
        // No identity: let the handshake proceed without one, so that "the
        // listener refuses a caller with no certificate" is observable rather
        // than hidden behind a local failure.
        completionHandler(.performDefaultHandling, nil)
        return
      }
      completionHandler(
        .useCredential,
        URLCredential(identity: identity, certificates: chain, persistence: .forSession)
      )

    case NSURLAuthenticationMethodServerTrust:
      guard let trust = challenge.protectionSpace.serverTrust else {
        completionHandler(.cancelAuthenticationChallenge, nil)
        return
      }
      if anchors.isEmpty {
        completionHandler(.performDefaultHandling, nil)
        return
      }
      SecTrustSetAnchorCertificates(trust, anchors as CFArray)
      // Only these: a private CA that is trusted *in addition to* the system's
      // would let a public certificate for the same name pass as well.
      SecTrustSetAnchorCertificatesOnly(trust, true)
      var error: CFError?
      if SecTrustEvaluateWithError(trust, &error) {
        completionHandler(.useCredential, URLCredential(trust: trust))
      } else {
        completionHandler(.cancelAuthenticationChallenge, nil)
      }

    default:
      completionHandler(.performDefaultHandling, nil)
    }
  }
}

public class ClientIdentityModule: Module {
  private var identity: SecIdentity?
  private var chain: [SecCertificate] = []
  private var anchors: [SecCertificate] = []

  public func definition() -> ModuleDefinition {
    Name("ClientIdentity")

    /**
     * Imports a PKCS#12 and keeps the identity it holds.
     *
     * Returns what was imported so a caller can show which identity is
     * presenting -- the subject, and how many certificates came with it.
     */
    AsyncFunction("importIdentity") { (base64: String, password: String) -> [String: Any] in
      guard let data = Data(base64Encoded: base64) else {
        throw ClientIdentityFailure("that is not base64")
      }
      var items: CFArray?
      let status = SecPKCS12Import(
        data as CFData,
        [kSecImportExportPassphrase as String: password] as CFDictionary,
        &items
      )
      if status == errSecAuthFailed {
        throw ClientIdentityFailure("the passphrase does not open that file")
      }
      // `as?` to a CoreFoundation type is refused by the compiler, because the
      // bridge always succeeds and the optional it hands back would be a lie.
      // So the type is checked by its ID and then cast unconditionally, which is
      // the same test written where it actually happens.
      guard status == errSecSuccess,
        let imported = items as? [[String: Any]],
        let first = imported.first,
        let held = first[kSecImportItemIdentity as String],
        CFGetTypeID(held as CFTypeRef) == SecIdentityGetTypeID()
      else {
        throw ClientIdentityFailure(
          "no identity in that file (SecPKCS12Import returned \(status))"
        )
      }
      let identity = held as! SecIdentity

      self.identity = identity
      self.chain = (first[kSecImportItemCertChain as String] as? [SecCertificate]) ?? []

      var certificate: SecCertificate?
      SecIdentityCopyCertificate(identity, &certificate)
      let subject =
        certificate.flatMap { SecCertificateCopySubjectSummary($0) as String? }
        ?? "an identity with no subject"
      return ["subject": subject, "chainLength": self.chain.count]
    }

    /**
     * The authorities to validate the server against, as PEM. Replaces
     * whatever was trusted before; an empty string goes back to the system's.
     */
    AsyncFunction("trustAuthorities") { (pem: String) -> Int in
      self.anchors = try Self.certificates(fromPem: pem)
      return self.anchors.count
    }

    /** Forgets the identity and the authorities: the end of a test. */
    Function("forget") {
      self.identity = nil
      self.chain = []
      self.anchors = []
    }

    Function("hasIdentity") { () -> Bool in
      self.identity != nil
    }

    /**
     * One request, with the identity presented if the server asks for one.
     *
     * Deliberately blocking on a semaphore rather than bridging a callback:
     * `AsyncFunction` already runs off the JavaScript thread, and a throwing
     * synchronous body is the part of the module API this was written against.
     */
    AsyncFunction("request") { (options: RequestOptions) -> [String: Any] in
      guard let url = URL(string: options.url) else {
        throw ClientIdentityFailure("\(options.url) is not a URL")
      }
      var request = URLRequest(url: url)
      request.httpMethod = options.method.uppercased()
      for (name, value) in options.headers {
        request.setValue(value, forHTTPHeaderField: name)
      }
      if let body = options.body {
        request.httpBody = body.data(using: .utf8)
      }

      let configuration = URLSessionConfiguration.ephemeral
      configuration.timeoutIntervalForRequest = options.timeout
      let session = URLSession(
        configuration: configuration,
        delegate: MutualTlsDelegate(
          identity: self.identity,
          chain: self.chain,
          anchors: self.anchors
        ),
        delegateQueue: nil
      )
      defer { session.finishTasksAndInvalidate() }

      var answer: [String: Any]?
      var failure: Error?
      let waiting = DispatchSemaphore(value: 0)
      session.dataTask(with: request) { data, response, error in
        defer { waiting.signal() }
        if let error {
          failure = error
          return
        }
        let http = response as? HTTPURLResponse
        var headers: [String: String] = [:]
        for (name, value) in http?.allHeaderFields ?? [:] {
          if let name = name as? String {
            headers[name.lowercased()] = String(describing: value)
          }
        }
        answer = [
          "status": http?.statusCode ?? 0,
          "headers": headers,
          "body": data.flatMap { String(data: $0, encoding: .utf8) } ?? "",
        ]
      }.resume()

      if waiting.wait(timeout: .now() + options.timeout + 5) == .timedOut {
        throw ClientIdentityFailure("the request did not finish")
      }
      if let failure {
        // A refused handshake arrives here, and its message is the only account
        // of it: the listener has nothing to say to a caller it never accepted.
        throw ClientIdentityFailure(failure.localizedDescription)
      }
      guard let answer else {
        throw ClientIdentityFailure("no response and no error, which should not happen")
      }
      return answer
    }
  }

  /** Every certificate in a PEM bundle, in the order they appear. */
  private static func certificates(fromPem pem: String) throws -> [SecCertificate] {
    let blocks = pem.components(separatedBy: "-----BEGIN CERTIFICATE-----")
      .dropFirst()
      .compactMap { $0.components(separatedBy: "-----END CERTIFICATE-----").first }
    var certificates: [SecCertificate] = []
    for block in blocks {
      let base64 = block.components(separatedBy: .whitespacesAndNewlines).joined()
      guard let der = Data(base64Encoded: base64),
        let certificate = SecCertificateCreateWithData(nil, der as CFData)
      else {
        throw ClientIdentityFailure("a PEM block is not a certificate")
      }
      certificates.append(certificate)
    }
    if certificates.isEmpty && !pem.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      throw ClientIdentityFailure("no BEGIN CERTIFICATE block in that file")
    }
    return certificates
  }
}
